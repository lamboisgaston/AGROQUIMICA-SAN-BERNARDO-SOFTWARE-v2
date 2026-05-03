const express = require('express');
const { PrismaClient, EstadoVenta } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

const usuarios = [
  { usuario: 'admin', password: 'admin123', rol: 'ADMINISTRADOR_GENERAL' },
  { usuario: 'gerente', password: 'gerente123', rol: 'GERENTE' },
  { usuario: 'operador', password: 'operador123', rol: 'MOSTRADOR' }
];

app.get('/', (req, res) => {
  res.json({ mensaje: 'Backend Agroquímica San Bernardo funcionando' });
});

app.post('/login', (req, res) => {
  const { usuario, password } = req.body;
  const encontrado = usuarios.find(u => u.usuario === usuario && u.password === password);

  if (!encontrado) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }

  res.json({
    mensaje: 'Login correcto',
    usuario: encontrado.usuario,
    rol: encontrado.rol
  });
});

async function obtenerTipoCambioActual() {
  const config = await prisma.configuracionGlobal.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, tipoCambioActual: 1 }
  });
  return config.tipoCambioActual;
}

function mapearProductoConPrecioPesos(producto, tipoCambioActual) {
  return {
    ...producto,
    precioPesosCalculado: producto.precioUsd * tipoCambioActual
  };
}

app.get('/productos', async (req, res) => {
  const tipoCambioActual = await obtenerTipoCambioActual();
  const productos = await prisma.producto.findMany();
  res.json(productos.map(p => mapearProductoConPrecioPesos(p, tipoCambioActual)));
});

app.post('/productos', async (req, res) => {
  const producto = await prisma.producto.create({ data: req.body });
  const tipoCambioActual = await obtenerTipoCambioActual();
  res.json(mapearProductoConPrecioPesos(producto, tipoCambioActual));
});

app.get('/config/tipo-cambio', async (req, res) => {
  const tipoCambioActual = await obtenerTipoCambioActual();
  res.json({ tipoCambioActual });
});

app.put('/config/tipo-cambio', async (req, res) => {
  const { tipoCambioActual } = req.body;
  if (typeof tipoCambioActual !== 'number' || tipoCambioActual <= 0) {
    return res.status(400).json({ error: 'tipoCambioActual (>0) es obligatorio' });
  }

  const config = await prisma.configuracionGlobal.upsert({
    where: { id: 1 },
    update: { tipoCambioActual },
    create: { id: 1, tipoCambioActual }
  });

  res.json({ tipoCambioActual: config.tipoCambioActual });
});

app.get('/personas', async (req, res) => {
  const personas = await prisma.persona.findMany();
  res.json(personas);
});

app.post('/personas', async (req, res) => {
  const { nombre, telefono, cuitDni, tipo } = req.body || {};
  if (!nombre || !telefono) {
    return res.status(400).json({ error: 'nombre y telefono son obligatorios' });
  }

  const persona = await prisma.persona.create({
    data: {
      nombre,
      telefono,
      cuitDni: cuitDni || null,
      tipo: tipo || 'CLIENTE'
    }
  });
  res.json(persona);
});

app.get('/personas/buscar', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json([]);

  const personas = await prisma.persona.findMany({
    where: {
      OR: [
        { nombre: { contains: q } },
        { telefono: { contains: q } },
        { cuitDni: { contains: q } }
      ]
    },
    take: 20,
    orderBy: { id: 'desc' }
  });

  res.json(personas);
});

app.post('/mostrador/ventas', async (req, res) => {
  const venta = await prisma.venta.create({ data: {} });
  res.status(201).json(venta);
});

app.get('/mostrador/ventas/:id', async (req, res) => {
  const venta = await prisma.venta.findUnique({
    where: { id: Number(req.params.id) },
    include: { persona: true, items: { include: { producto: true } } }
  });

  if (!venta) {
    return res.status(404).json({ error: 'Venta no encontrada' });
  }

  res.json(venta);
});

app.post('/mostrador/ventas/:id/items', async (req, res) => {
  const ventaId = Number(req.params.id);
  const { productoId, cantidad } = req.body;

  if (!productoId || !cantidad || cantidad <= 0) {
    return res.status(400).json({ error: 'productoId y cantidad (>0) son obligatorios' });
  }

  const venta = await prisma.venta.findUnique({ where: { id: ventaId } });
  if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
  if (venta.estado !== EstadoVenta.BORRADOR) {
    return res.status(400).json({ error: 'Solo se pueden editar ventas en BORRADOR' });
  }

  const producto = await prisma.producto.findUnique({ where: { id: Number(productoId) } });
  if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
  const tipoCambioActual = await obtenerTipoCambioActual();
  const precioPesosCalculado = producto.precioUsd * tipoCambioActual;

  const existente = await prisma.ventaItem.findUnique({
    where: { ventaId_productoId: { ventaId, productoId: Number(productoId) } }
  });

  const cantidadFinal = (existente?.cantidad || 0) + Number(cantidad);
  if (cantidadFinal > producto.stock) {
    return res.status(400).json({ error: 'Stock insuficiente para ese producto' });
  }

  await prisma.ventaItem.upsert({
    where: { ventaId_productoId: { ventaId, productoId: Number(productoId) } },
    create: {
      ventaId,
      productoId: Number(productoId),
      cantidad: Number(cantidad),
      precioUnitario: precioPesosCalculado,
      subtotal: precioPesosCalculado * Number(cantidad)
    },
    update: {
      cantidad: cantidadFinal,
      precioUnitario: precioPesosCalculado,
      subtotal: precioPesosCalculado * cantidadFinal
    }
  });

  const items = await prisma.ventaItem.findMany({ where: { ventaId } });
  const total = items.reduce((acc, item) => acc + item.subtotal, 0);
  const ventaActualizada = await prisma.venta.update({
    where: { id: ventaId },
    data: { total },
    include: { persona: true, items: true }
  });

  res.json(ventaActualizada);
});


app.put('/mostrador/ventas/:id/items/:productoId', async (req, res) => {
  const ventaId = Number(req.params.id);
  const productoId = Number(req.params.productoId);
  const { cantidad } = req.body || {};

  if (!Number.isInteger(cantidad) || cantidad < 0) {
    return res.status(400).json({ error: 'cantidad debe ser entero >= 0' });
  }

  const venta = await prisma.venta.findUnique({ where: { id: ventaId } });
  if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
  if (venta.estado !== EstadoVenta.BORRADOR) {
    return res.status(400).json({ error: 'Solo se pueden editar ventas en BORRADOR' });
  }

  const existente = await prisma.ventaItem.findUnique({
    where: { ventaId_productoId: { ventaId, productoId } }
  });
  if (!existente) return res.status(404).json({ error: 'Item no encontrado en la venta' });

  if (cantidad === 0) {
    await prisma.ventaItem.delete({ where: { id: existente.id } });
  } else {
    const producto = await prisma.producto.findUnique({ where: { id: productoId } });
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    if (cantidad > producto.stock) {
      return res.status(400).json({ error: 'Stock insuficiente para ese producto' });
    }

    await prisma.ventaItem.update({
      where: { id: existente.id },
      data: { cantidad, subtotal: existente.precioUnitario * cantidad }
    });
  }

  const items = await prisma.ventaItem.findMany({ where: { ventaId } });
  const total = items.reduce((acc, item) => acc + item.subtotal, 0);
  const ventaActualizada = await prisma.venta.update({
    where: { id: ventaId },
    data: { total },
    include: { persona: true, items: { include: { producto: true } } }
  });

  res.json(ventaActualizada);
});

app.put('/mostrador/ventas/:id/persona', async (req, res) => {
  const ventaId = Number(req.params.id);
  const { personaId, nombre, telefono, tipo, cuitDni } = req.body;

  const venta = await prisma.venta.findUnique({ where: { id: ventaId } });
  if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
  if (venta.estado !== EstadoVenta.BORRADOR) {
    return res.status(400).json({ error: 'Solo se puede asociar persona a ventas en BORRADOR' });
  }

  let persona;
  if (personaId) {
    persona = await prisma.persona.findUnique({ where: { id: Number(personaId) } });
    if (!persona) return res.status(404).json({ error: 'Persona no encontrada' });
  } else {
    if (!nombre || !telefono || !cuitDni) {
      return res.status(400).json({ error: 'Debe enviar personaId o bien nombre, telefono y cuitDni' });
    }
    persona = await prisma.persona.create({
      data: {
        nombre,
        telefono,
        cuitDni,
        tipo: tipo || 'CONSUMIDOR_FINAL'
      }
    });
  }

  const ventaActualizada = await prisma.venta.update({
    where: { id: ventaId },
    data: { personaId: persona.id },
    include: { persona: true, items: true }
  });

  res.json(ventaActualizada);
});

app.post('/mostrador/ventas/:id/cerrar', async (req, res) => {
  const ventaId = Number(req.params.id);

  const venta = await prisma.venta.findUnique({
    where: { id: ventaId },
    include: { persona: true, items: true }
  });

  if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
  if (venta.estado !== EstadoVenta.BORRADOR) {
    return res.status(400).json({ error: 'La venta ya no está en BORRADOR' });
  }
  if (!venta.persona || !venta.persona.nombre || !venta.persona.telefono || !venta.persona.cuitDni) {
    return res.status(400).json({ error: 'Antes de cerrar la venta debe existir nombre, telefono y CUIT/DNI' });
  }
  if (venta.items.length === 0) {
    return res.status(400).json({ error: 'No se puede cerrar una venta sin productos' });
  }

  await prisma.$transaction(async tx => {
    for (const item of venta.items) {
      const producto = await tx.producto.findUnique({ where: { id: item.productoId } });
      if (!producto || producto.stock < item.cantidad) {
        throw new Error(`Stock insuficiente para producto ${item.productoId}`);
      }
      await tx.producto.update({
        where: { id: item.productoId },
        data: { stock: { decrement: item.cantidad } }
      });
    }

    await tx.venta.update({
      where: { id: ventaId },
      data: { estado: EstadoVenta.PENDIENTE_CAJA }
    });
  });

  const ventaCerrada = await prisma.venta.findUnique({
    where: { id: ventaId },
    include: { persona: true, items: { include: { producto: true } } }
  });

  res.json(ventaCerrada);
});

app.get('/caja/ventas', async (req, res) => {
  const ventas = await prisma.venta.findMany({
    where: { estado: EstadoVenta.PENDIENTE_CAJA },
    include: { persona: true, items: { include: { producto: true } } },
    orderBy: { createdAt: 'asc' }
  });

  res.json(ventas);
});

app.post('/caja/cobrar/:id', async (req, res) => {
  const ventaId = Number(req.params.id);
  const { medioPago } = req.body || {};
  const venta = await prisma.venta.findUnique({ where: { id: ventaId } });

  if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
  if (venta.estado !== EstadoVenta.PENDIENTE_CAJA) {
    return res.status(400).json({ error: 'La venta no está pendiente de caja' });
  }

  if (medioPago === 'CUENTA_CORRIENTE') {
    const ventaConPersona = await prisma.venta.findUnique({
      where: { id: ventaId },
      include: { persona: true }
    });

    if (!ventaConPersona?.personaId) {
      return res.status(400).json({ error: 'La venta debe tener una persona para enviarla a cuenta corriente' });
    }

    await prisma.$transaction(async tx => {
      const cuenta = await tx.cuentaCorriente.upsert({
        where: { personaId: ventaConPersona.personaId },
        update: { saldo: { increment: ventaConPersona.total } },
        create: {
          personaId: ventaConPersona.personaId,
          saldo: ventaConPersona.total
        }
      });

      await tx.movimientoCuentaCorriente.create({
        data: {
          cuentaCorrienteId: cuenta.id,
          ventaId: ventaConPersona.id,
          tipo: 'DEBITO',
          monto: ventaConPersona.total,
          descripcion: `Venta #${ventaConPersona.id} enviada a cuenta corriente`
        }
      });

      await tx.venta.update({
        where: { id: ventaId },
        data: { estado: EstadoVenta.COBRADA }
      });
    });
  } else {
    await prisma.venta.update({
      where: { id: ventaId },
      data: { estado: EstadoVenta.COBRADA }
    });
  }

  const ventaCobrada = await prisma.venta.findUnique({
    where: { id: ventaId },
    include: { persona: true, items: { include: { producto: true } } }
  });

  res.json(ventaCobrada);
});

app.get('/cuenta-corriente/personas/:personaId', async (req, res) => {
  const personaId = Number(req.params.personaId);
  const cuenta = await prisma.cuentaCorriente.findUnique({
    where: { personaId },
    include: {
      persona: true,
      movimientos: {
        orderBy: { createdAt: 'desc' },
        include: { venta: true }
      }
    }
  });

  if (!cuenta) return res.status(404).json({ error: 'Cuenta corriente no encontrada' });
  res.json(cuenta);
});

app.post('/cuenta-corriente/personas/:personaId/pagos', async (req, res) => {
  const personaId = Number(req.params.personaId);
  const { monto, descripcion } = req.body;

  if (!monto || Number(monto) <= 0) {
    return res.status(400).json({ error: 'monto (>0) es obligatorio' });
  }

  const cuenta = await prisma.cuentaCorriente.findUnique({ where: { personaId } });
  if (!cuenta) return res.status(404).json({ error: 'Cuenta corriente no encontrada' });
  if (Number(monto) > cuenta.saldo) {
    return res.status(400).json({ error: 'El pago no puede ser mayor al saldo actual' });
  }

  const cuentaActualizada = await prisma.$transaction(async tx => {
    const updated = await tx.cuentaCorriente.update({
      where: { id: cuenta.id },
      data: { saldo: { decrement: Number(monto) } }
    });

    await tx.movimientoCuentaCorriente.create({
      data: {
        cuentaCorrienteId: cuenta.id,
        tipo: 'CREDITO',
        monto: Number(monto),
        descripcion: descripcion || 'Pago de cuenta corriente'
      }
    });

    return updated;
  });

  res.json(cuentaActualizada);
});

app.get('/app', (req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="es">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Caja Mostrador</title>
<style>
body{font-family:Arial,sans-serif;margin:0;background:#e5e7eb;color:#111827} .app{display:grid;grid-template-columns:1.2fr .8fr;gap:10px;padding:10px;max-width:1400px;margin:0 auto} .panel{background:#fff;border:1px solid #cbd5e1;padding:10px} .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap} input,select,button{font-size:18px;padding:10px;border:1px solid #94a3b8;border-radius:6px;color:#111827;background:#fff} button{background:#0f766e;color:#fff;border-color:#0f766e;cursor:pointer;font-weight:700} .danger{background:#b91c1c;border-color:#b91c1c}.search{width:100%;font-size:26px;padding:12px} .results{border:1px solid #cbd5e1;max-height:310px;overflow:auto;margin-top:6px} .result{display:grid;grid-template-columns:1fr auto auto;gap:8px;padding:8px;border-bottom:1px solid #e2e8f0;cursor:pointer}.result:hover{background:#f1f5f9} .mono{font-weight:700} table{width:100%;border-collapse:collapse} th,td{border-bottom:1px solid #e2e8f0;padding:6px;text-align:left} .qty{display:flex;gap:6px} .qty button{padding:6px 12px;font-size:20px} .total{font-size:46px;font-weight:900;margin:8px 0;color:#0f172a} .pending{border:1px solid #cbd5e1;padding:8px;margin-top:8px;background:#f8fafc}
</style></head><body>
<div class="app">
<section class="panel"><h2>Mostrador</h2><div class="row"><button id="nueva">Nueva venta</button><strong id="vid">Sin venta activa</strong></div>
<input id="q" class="search" placeholder="Buscar producto..." />
<div id="results" class="results"></div>
<h3>Carrito (siempre visible)</h3><table><thead><tr><th>Producto</th><th>Cant.</th><th>P.Unit</th><th>Subtotal</th></tr></thead><tbody id="cart"></tbody></table>
<div class="row"><label>% Desc.<input id="dp" type="number" value="0" min="0" max="100" style="width:110px"/></label><label>Monto Desc.<input id="df" type="number" value="0" min="0" style="width:140px"/></label></div>
<div>
<div>Total: <span id="tt" class="mono">$0.00</span></div><div class="total">Final: $<span id="tf">0.00</span></div>
</div>
<h3>Datos comprador</h3><div class="row"><input id="buyerSearch" placeholder="Buscar por nombre, teléfono o CUIT/DNI"/><button id="buscarComprador">Buscar</button></div>
<div id="buyerResults" class="pending">Sin búsqueda</div>
<div id="buyerCreate" style="display:none"><div class="row"><input id="nom" placeholder="Nombre"/><input id="tel" placeholder="Teléfono"/><input id="cuit" placeholder="CUIT/DNI"/></div><div class="row"><button id="crearComprador">Crear comprador</button></div></div>
<div class="row"><button id="cerrar" class="danger">Cerrar venta</button></div>
<div id="buyerActive">Comprador activo: Sin seleccionar</div>
</section>
<section class="panel"><h2>Caja simple</h2><div id="pend"></div></section></div><p id="st"></p>
<script>let ventaId=null,productos=[],venta=null,f='';const $=s=>document.querySelector(s),money=v=>Number(v||0).toFixed(2);const set=m=>$('#st').textContent=m;async function api(u,o={}){const r=await fetch(u,{headers:{'Content-Type':'application/json'},...o});const d=await r.json();if(!r.ok) throw new Error(d.error||'Error');return d;}
function renderProd(){const l=$('#results');const q=f.toLowerCase().trim();const xs=productos.filter(p=>p.stock>0&&(!q||p.nombre.toLowerCase().includes(q))).slice(0,6);l.innerHTML=xs.map(p=>'<div class=\"result\" data-id=\"'+p.id+'\"><span>'+p.nombre+'</span><span class=\"mono\">$'+money(p.precioPesosCalculado)+'</span><span>Stock:'+p.stock+'</span></div>').join('')||'<div style=\"padding:8px\">Sin resultados</div>';}
function totalFinal(){const t=Number(venta?.total||0),dp=Math.max(0,Math.min(100,Number($('#dp').value||0))),df=Math.max(0,Number($('#df').value||0));const fin=Math.max(0,t-(t*dp/100)-df);$('#tt').textContent='$'+money(t);$('#tf').textContent=money(fin);}
function renderVenta(){const b=$('#cart');b.innerHTML='';if(!venta||!venta.items?.length){b.innerHTML='<tr><td colspan=4>Sin productos</td></tr>';totalFinal();return;}for(const i of venta.items){b.innerHTML+='<tr><td>'+i.producto.nombre+'</td><td><div class=\"qty\"><button data-a=\"-\" data-p=\"'+i.productoId+'\">-</button><b>'+i.cantidad+'</b><button data-a=\"+\" data-p=\"'+i.productoId+'\">+</button></div></td><td>$'+money(i.precioUnitario)+'</td><td>$'+money(i.subtotal)+'</td></tr>'; }totalFinal();}
function renderCompradorActivo(){const p=venta?.persona;$('#buyerActive').textContent='Comprador activo: '+(p?(p.nombre+' | '+p.telefono+' | '+(p.cuitDni||'Sin CUIT/DNI')):'Sin seleccionar');}
function renderResultadosComprador(list){if(!list.length){$('#buyerResults').innerHTML='No se encontraron resultados. <button id=\"showCreate\">Crear comprador</button>';return;}$('#buyerResults').innerHTML=list.map(p=>'<div class=\"pending\"><div><b>'+p.nombre+'</b> - '+p.telefono+' - '+(p.cuitDni||'Sin CUIT/DNI')+'</div><button data-persona=\"'+p.id+'\">Seleccionar</button></div>').join('');}
async function refresh(){if(!ventaId) return;venta=await api('/mostrador/ventas/'+ventaId);$('#vid').textContent='Venta #'+venta.id;renderVenta();renderCompradorActivo();}
async function load(){productos=await api('/productos');renderProd();const vs=await api('/caja/ventas');$('#pend').innerHTML=vs.map(v=>'<div class=\"pending\"><div><b>Venta #'+v.id+'</b> - '+(v.persona?.nombre||'Sin cliente')+'</div><div>Total $'+money(v.total)+'</div><select id=\"m'+v.id+'\"><option>EFECTIVO</option><option>TRANSFERENCIA</option><option>TARJETA</option><option>CUENTA_CORRIENTE</option></select><button onclick=\"cob('+v.id+')\">Cobrar</button></div>').join('')||'No hay ventas pendientes';}
window.cob=async id=>{try{await api('/caja/cobrar/'+id,{method:'POST',body:JSON.stringify({medioPago:document.getElementById('m'+id).value})});set('Venta cobrada');await Promise.all([load(),refresh()]);}catch(e){set(e.message)}};
$('#nueva').onclick=async()=>{const v=await api('/mostrador/ventas',{method:'POST',body:'{}'});ventaId=v.id;await refresh();set('Venta creada');};$('#q').oninput=e=>{f=e.target.value;renderProd();};$('#results').onclick=async e=>{const r=e.target.closest('[data-id]');if(!r||!ventaId)return;await api('/mostrador/ventas/'+ventaId+'/items',{method:'POST',body:JSON.stringify({productoId:Number(r.dataset.id),cantidad:1})});await Promise.all([refresh(),load()]);};$('#cart').onclick=async e=>{const b=e.target.closest('button[data-p]');if(!b||!ventaId)return;const pid=Number(b.dataset.p);const it=venta.items.find(x=>x.productoId===pid);const c=b.dataset.a==='+'?it.cantidad+1:it.cantidad-1;await api('/mostrador/ventas/'+ventaId+'/items/'+pid,{method:'PUT',body:JSON.stringify({cantidad:Math.max(0,c)})});await Promise.all([refresh(),load()]);};
$('#buscarComprador').onclick=async()=>{const q=$('#buyerSearch').value.trim();if(!q){$('#buyerResults').textContent='Ingrese un criterio de búsqueda';return;}const rs=await api('/personas/buscar?q='+encodeURIComponent(q));renderResultadosComprador(rs);$('#buyerCreate').style.display='none';};
$('#buyerResults').onclick=async e=>{if(e.target.id==='showCreate'){$('#buyerCreate').style.display='block';return;}const b=e.target.closest('button[data-persona]');if(!b||!ventaId)return;await api('/mostrador/ventas/'+ventaId+'/persona',{method:'PUT',body:JSON.stringify({personaId:Number(b.dataset.persona)})});await refresh();set('Comprador seleccionado');};
$('#crearComprador').onclick=async()=>{if(!ventaId)return;const persona=await api('/personas',{method:'POST',body:JSON.stringify({nombre:$('#nom').value,telefono:$('#tel').value,cuitDni:$('#cuit').value,tipo:'CLIENTE'})});await api('/mostrador/ventas/'+ventaId+'/persona',{method:'PUT',body:JSON.stringify({personaId:persona.id})});$('#buyerCreate').style.display='none';$('#buyerResults').textContent='Comprador creado y seleccionado';await refresh();set('Comprador creado');};
$('#cerrar').onclick=async()=>{if(!ventaId)return;await api('/mostrador/ventas/'+ventaId+'/cerrar',{method:'POST',body:'{}'});ventaId=null;venta=null;$('#vid').textContent='Sin venta activa';renderVenta();renderCompradorActivo();await load();set('Venta enviada a caja');};$('#dp').oninput=totalFinal;$('#df').oninput=totalFinal;(async()=>{await load();renderVenta();renderCompradorActivo();})();
</script></body></html>`);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor funcionando en puerto ${PORT}`);
});
