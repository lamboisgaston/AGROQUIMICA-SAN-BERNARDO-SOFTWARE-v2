(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ArgentinaUbicaciones = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const normalizar = (valor) => String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const PROVINCIAS_ARGENTINA = [
    { id: 'ar-caba', nombre: 'Ciudad Autónoma de Buenos Aires' },
    { id: 'ar-buenos-aires', nombre: 'Buenos Aires' },
    { id: 'ar-catamarca', nombre: 'Catamarca' },
    { id: 'ar-chaco', nombre: 'Chaco' },
    { id: 'ar-chubut', nombre: 'Chubut' },
    { id: 'ar-cordoba', nombre: 'Córdoba' },
    { id: 'ar-corrientes', nombre: 'Corrientes' },
    { id: 'ar-entre-rios', nombre: 'Entre Ríos' },
    { id: 'ar-formosa', nombre: 'Formosa' },
    { id: 'ar-jujuy', nombre: 'Jujuy' },
    { id: 'ar-la-pampa', nombre: 'La Pampa' },
    { id: 'ar-la-rioja', nombre: 'La Rioja' },
    { id: 'ar-mendoza', nombre: 'Mendoza' },
    { id: 'ar-misiones', nombre: 'Misiones' },
    { id: 'ar-neuquen', nombre: 'Neuquén' },
    { id: 'ar-rio-negro', nombre: 'Río Negro' },
    { id: 'ar-salta', nombre: 'Salta' },
    { id: 'ar-san-juan', nombre: 'San Juan' },
    { id: 'ar-san-luis', nombre: 'San Luis' },
    { id: 'ar-santa-cruz', nombre: 'Santa Cruz' },
    { id: 'ar-santa-fe', nombre: 'Santa Fe' },
    { id: 'ar-santiago-del-estero', nombre: 'Santiago del Estero' },
    { id: 'ar-tierra-del-fuego', nombre: 'Tierra del Fuego' },
    { id: 'ar-tucuman', nombre: 'Tucumán' }
  ];

  const localidadesPorProvincia = {
    'ar-caba': ['Ciudad Autónoma de Buenos Aires', 'Palermo', 'Belgrano', 'Flores', 'Caballito', 'Villa Urquiza', 'Recoleta', 'Mataderos'],
    'ar-buenos-aires': ['La Plata', 'Mar del Plata', 'Bahía Blanca', 'Tandil', 'Olavarría', 'Azul', 'Junín', 'Pergamino', 'San Nicolás de los Arroyos', 'Necochea', 'Tres Arroyos', 'Chivilcoy', 'Luján', 'Mercedes', 'Zárate', 'Campana', 'Pilar', 'San Miguel', 'Morón', 'Quilmes', 'Avellaneda', 'Lanús', 'Lomas de Zamora', 'San Isidro', 'Tigre'],
    'ar-catamarca': ['San Fernando del Valle de Catamarca', 'Andalgalá', 'Belén', 'Santa María', 'Tinogasta', 'Fiambalá', 'Recreo', 'Valle Viejo', 'Fray Mamerto Esquiú', 'Pomán'],
    'ar-chaco': ['Resistencia', 'Presidencia Roque Sáenz Peña', 'Villa Ángela', 'Charata', 'General José de San Martín', 'Juan José Castelli', 'Las Breñas', 'Quitilipi', 'Machagai', 'Barranqueras'],
    'ar-chubut': ['Rawson', 'Comodoro Rivadavia', 'Trelew', 'Puerto Madryn', 'Esquel', 'Sarmiento', 'Gaiman', 'Dolavon', 'Trevelin', 'Rada Tilly'],
    'ar-cordoba': ['Córdoba Capital', 'Río Cuarto', 'Villa María', 'San Francisco', 'Villa Carlos Paz', 'Alta Gracia', 'Jesús María', 'Río Tercero', 'Bell Ville', 'Marcos Juárez', 'Laboulaye', 'Villa Dolores', 'Deán Funes'],
    'ar-corrientes': ['Corrientes Capital', 'Goya', 'Mercedes', 'Paso de los Libres', 'Curuzú Cuatiá', 'Santo Tomé', 'Bella Vista', 'Esquina', 'Monte Caseros', 'Ituzaingó'],
    'ar-entre-rios': ['Paraná', 'Concordia', 'Gualeguaychú', 'Concepción del Uruguay', 'Gualeguay', 'Villaguay', 'Victoria', 'Chajarí', 'Colón', 'La Paz', 'Crespo'],
    'ar-formosa': ['Formosa Capital', 'Clorinda', 'Pirané', 'El Colorado', 'Las Lomitas', 'Ibarreta', 'Ingeniero Juárez', 'Comandante Fontana', 'Villa Dos Trece'],
    'ar-jujuy': ['San Salvador de Jujuy', 'Palpalá', 'Perico', 'San Pedro de Jujuy', 'Libertador General San Martín', 'Humahuaca', 'Tilcara', 'La Quiaca', 'El Carmen', 'Monterrico'],
    'ar-la-pampa': ['Santa Rosa', 'General Pico', 'General Acha', 'Toay', 'Realicó', 'Eduardo Castex', 'Intendente Alvear', 'Victorica', 'Macachín'],
    'ar-la-rioja': ['La Rioja Capital', 'Chilecito', 'Aimogasta', 'Chamical', 'Chepes', 'Villa Unión', 'Famatina', 'Nonogasta', 'Olta'],
    'ar-mendoza': ['Mendoza Capital', 'San Rafael', 'Godoy Cruz', 'Guaymallén', 'Las Heras', 'Maipú', 'Luján de Cuyo', 'Tunuyán', 'Tupungato', 'General Alvear', 'San Martín', 'Rivadavia', 'Malargüe'],
    'ar-misiones': ['Posadas', 'Oberá', 'Eldorado', 'Puerto Iguazú', 'Apóstoles', 'Leandro N. Alem', 'Jardín América', 'Montecarlo', 'San Vicente', 'Puerto Rico'],
    'ar-neuquen': ['Neuquén Capital', 'Cutral Có', 'Plottier', 'Zapala', 'San Martín de los Andes', 'Villa La Angostura', 'Centenario', 'Chos Malal', 'Junín de los Andes', 'Rincón de los Sauces'],
    'ar-rio-negro': ['Viedma', 'San Carlos de Bariloche', 'General Roca', 'Cipolletti', 'Villa Regina', 'Allen', 'Cinco Saltos', 'Choele Choel', 'El Bolsón', 'Catriel'],
    'ar-salta': ['Salta Capital', 'San Ramón de la Nueva Orán', 'Tartagal', 'General Güemes', 'Rosario de la Frontera', 'Metán', 'Cafayate', 'Joaquín V. González', 'Embarcación', 'Pichanal', 'Colonia Santa Rosa'],
    'ar-san-juan': ['San Juan Capital', 'Rawson', 'Rivadavia', 'Chimbas', 'Santa Lucía', 'Pocito', 'Caucete', 'Jáchal', 'Albardón', 'Sarmiento'],
    'ar-san-luis': ['San Luis Capital', 'Villa Mercedes', 'Merlo', 'La Punta', 'Justo Daract', 'Quines', 'Tilisarao', 'Concarán', 'Santa Rosa del Conlara'],
    'ar-santa-cruz': ['Río Gallegos', 'Caleta Olivia', 'Pico Truncado', 'Puerto Deseado', 'Las Heras', 'El Calafate', 'Perito Moreno', 'Puerto San Julián', 'Gobernador Gregores'],
    'ar-santa-fe': ['Santa Fe Capital', 'Rosario', 'Rafaela', 'Venado Tuerto', 'Reconquista', 'Villa Gobernador Gálvez', 'Santo Tomé', 'Esperanza', 'Casilda', 'Cañada de Gómez', 'Sunchales', 'San Lorenzo'],
    'ar-santiago-del-estero': ['Santiago del Estero Capital', 'La Banda', 'Termas de Río Hondo', 'Añatuya', 'Frías', 'Fernández', 'Quimilí', 'Loreto', 'Clodomira', 'Monte Quemado'],
    'ar-tierra-del-fuego': ['Ushuaia', 'Río Grande', 'Tolhuin'],
    'ar-tucuman': ['San Miguel de Tucumán', 'Yerba Buena', 'Tafí Viejo', 'Banda del Río Salí', 'Concepción', 'Aguilares', 'Monteros', 'Famaillá', 'Bella Vista', 'Lules', 'Tafí del Valle']
  };

  const LOCALIDADES_ARGENTINA = Object.entries(localidadesPorProvincia).flatMap(([provinciaId, nombres]) => {
    const provincia = PROVINCIAS_ARGENTINA.find((p) => p.id === provinciaId);
    return nombres.map((nombre, index) => ({
      id: `${provinciaId}-loc-${String(index + 1).padStart(3, '0')}`,
      nombre,
      provinciaId,
      provinciaNombre: provincia ? provincia.nombre : ''
    }));
  });

  function buscarProvincia(valor) {
    const clave = normalizar(valor);
    return PROVINCIAS_ARGENTINA.find((p) => p.id === valor || normalizar(p.nombre) === clave) || null;
  }

  function localidadesDeProvincia(provinciaId) {
    return LOCALIDADES_ARGENTINA.filter((l) => l.provinciaId === provinciaId);
  }

  function buscarLocalidades(texto, provinciaId = '') {
    const q = normalizar(texto);
    const base = provinciaId ? localidadesDeProvincia(provinciaId) : LOCALIDADES_ARGENTINA;
    if (!q) return base;
    return base.filter((l) => normalizar(l.nombre).includes(q));
  }

  function buscarLocalidadExacta(nombre, provinciaId = '') {
    const clave = normalizar(nombre);
    return buscarLocalidades('', provinciaId).find((l) => normalizar(l.nombre) === clave) || null;
  }

  function validarUbicacion({ provinciaId, provincia, localidadId, localidad }) {
    const prov = provinciaId ? buscarProvincia(provinciaId) : buscarProvincia(provincia);
    if (!prov) return { ok: false, error: 'Provincia inválida', provincia: null, localidad: null };
    let loc = localidadId ? LOCALIDADES_ARGENTINA.find((l) => l.id === localidadId) : null;
    if (loc && loc.provinciaId !== prov.id) return { ok: false, error: 'La localidad no pertenece a la provincia seleccionada', provincia: prov, localidad: null };
    if (!loc) loc = buscarLocalidadExacta(localidad, prov.id);
    if (!loc) return { ok: false, error: 'Localidad inválida para la provincia seleccionada', provincia: prov, localidad: null };
    return { ok: true, provincia: prov, localidad: loc };
  }

  function detectarLocalidadesEnTexto(texto) {
    const q = normalizar(texto);
    if (!q) return [];
    return LOCALIDADES_ARGENTINA.filter((l) => {
      const ln = normalizar(l.nombre);
      return ln && (q.includes(ln) || ln.includes(q));
    });
  }

  return { PROVINCIAS_ARGENTINA, LOCALIDADES_ARGENTINA, normalizar, buscarProvincia, localidadesDeProvincia, buscarLocalidades, buscarLocalidadExacta, validarUbicacion, detectarLocalidadesEnTexto };
});
