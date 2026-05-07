import sqlite3
import sys
from pathlib import Path
from openpyxl import load_workbook

DB_PATH = Path(__file__).resolve().parent.parent / 'prisma' / 'dev.db'
EXCEL_PATH = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / 'precios.xlsx'


def text(v):
    return str(v or '').strip()


def parse_number(v, default=0.0):
    if v is None or v == '':
        return default
    s = str(v).strip().replace('.', '').replace(',', '.')
    try:
        return float(s)
    except ValueError:
        return default


def key(d):
    return '|'.join([text(d['nombre']).lower(), text(d['categoria']).lower(), text(d['marca']).lower(), text(d['unidad']).lower()])


def normalize(row):
    moneda = text(row.get('monedaCosto') or row.get('monedaCompra') or row.get('moneda')).upper()
    moneda = 'USD' if moneda == 'USD' else 'ARS'
    costo = parse_number(row.get('costoBase') or row.get('costoCompra') or row.get('costo'))
    precio_final = parse_number(row.get('precioFinalPesos') or row.get('precioVenta') or row.get('precio'))
    precio_usd_raw = row.get('precioUsd')
    precio_usd = parse_number(precio_usd_raw) if precio_usd_raw not in (None, '') else (costo if moneda == 'USD' else None)

    return {
        'nombre': text(row.get('nombre') or row.get('producto') or row.get('descripcion')),
        'categoria': text(row.get('categoria') or row.get('rubro') or row.get('familia')),
        'marca': text(row.get('marca')),
        'unidad': text(row.get('unidad') or row.get('presentacion')),
        'stock': int(parse_number(row.get('stock'), 0)),
        'monedaCosto': moneda,
        'costoBase': costo,
        'precioVenta': precio_final,
        'porcentajeUva': parse_number(row.get('porcentajeUva') or row.get('ivaPorcentaje') or row.get('iva')),
        'porcentajeFlete': parse_number(row.get('porcentajeFlete') or row.get('fletePorcentaje') or row.get('flete')),
        'porcentajeGanancia': parse_number(row.get('porcentajeGanancia') or row.get('gananciaPorcentaje') or row.get('margen')),
        'precioFinalPesos': precio_final,
        'precioUsd': precio_usd,
    }


def main():
    wb = load_workbook(EXCEL_PATH, data_only=True)
    ws = wb[wb.sheetnames[0]]
    headers = [text(c.value) for c in next(ws.iter_rows(min_row=1, max_row=1))]
    rows = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        if all(v is None or str(v).strip() == '' for v in row):
            continue
        rows.append({headers[i]: row[i] for i in range(len(headers))})

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute('SELECT * FROM Producto')
    existentes = {key(dict(r)): dict(r) for r in cur.fetchall()}

    creados = actualizados = ignorados = 0
    for raw in rows:
        p = normalize(raw)
        if not p['nombre'] or not p['categoria']:
            ignorados += 1
            continue
        k = key(p)
        if k in existentes:
            cur.execute('''
                UPDATE Producto SET nombre=?, categoria=?, marca=?, unidad=?, stock=?, monedaCosto=?, costoBase=?, precioVenta=?, porcentajeUva=?, porcentajeFlete=?, porcentajeGanancia=?, precioFinalPesos=?, precioUsd=? WHERE id=?
            ''', (p['nombre'], p['categoria'], p['marca'], p['unidad'], p['stock'], p['monedaCosto'], p['costoBase'], p['precioVenta'], p['porcentajeUva'], p['porcentajeFlete'], p['porcentajeGanancia'], p['precioFinalPesos'], p['precioUsd'], existentes[k]['id']))
            actualizados += 1
        else:
            cur.execute('''
                INSERT INTO Producto (nombre,categoria,marca,unidad,stock,monedaCosto,costoBase,precioVenta,porcentajeUva,porcentajeFlete,porcentajeGanancia,precioFinalPesos,precioUsd)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
            ''', (p['nombre'], p['categoria'], p['marca'], p['unidad'], p['stock'], p['monedaCosto'], p['costoBase'], p['precioVenta'], p['porcentajeUva'], p['porcentajeFlete'], p['porcentajeGanancia'], p['precioFinalPesos'], p['precioUsd']))
            creados += 1
    conn.commit()
    conn.close()
    print(f'Importación finalizada. Creados: {creados}. Actualizados: {actualizados}. Ignorados: {ignorados}.')


if __name__ == '__main__':
    main()
