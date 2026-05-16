#!/usr/bin/env python3
import sqlite3, zipfile, xml.etree.ElementTree as ET, re, os
from pathlib import Path

XLSX_PATH = Path('precios.xlsx')
DB_PATHS = [Path('dev.db'), Path('prisma/dev.db')]

NS_MAIN = {'a': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
NS_REL = {'r': 'http://schemas.openxmlformats.org/package/2006/relationships'}

UNIDADES = ['lts','litro','litros','ml','cm3','cc','kgr','kg','gramos','gr','g','bolsa','bidon']


def read_first_sheet_rows(xlsx_path: Path):
    with zipfile.ZipFile(xlsx_path) as z:
        shared = []
        if 'xl/sharedStrings.xml' in z.namelist():
            root_shared = ET.fromstring(z.read('xl/sharedStrings.xml'))
            for si in root_shared.findall('a:si', NS_MAIN):
                shared.append(''.join(t.text or '' for t in si.findall('.//a:t', NS_MAIN)))

        wb = ET.fromstring(z.read('xl/workbook.xml'))
        first_sheet = wb.find('a:sheets/a:sheet', NS_MAIN)
        rid = first_sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']

        rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
        sheet_path = None
        for rel in rels.findall('r:Relationship', NS_REL):
            if rel.attrib.get('Id') == rid:
                sheet_path = 'xl/' + rel.attrib['Target'].lstrip('/')
                break

        if not sheet_path:
            raise RuntimeError('No se encontró la primera hoja del Excel')

        sheet = ET.fromstring(z.read(sheet_path))
        for row in sheet.findall('.//a:sheetData/a:row', NS_MAIN):
            values = {}
            for c in row.findall('a:c', NS_MAIN):
                ref = c.attrib.get('r', '')
                m = re.match(r'([A-Z]+)', ref)
                if not m:
                    continue
                col = m.group(1)
                t = c.attrib.get('t')
                v = c.find('a:v', NS_MAIN)
                if v is None:
                    val = ''
                else:
                    raw = (v.text or '').strip()
                    if t == 's' and raw.isdigit():
                        val = shared[int(raw)]
                    else:
                        val = raw
                values[col] = val
            yield values


def detect_unidad(nombre: str) -> str:
    n = nombre.lower()
    for u in UNIDADES:
        if re.search(rf'\b{re.escape(u)}\b', n):
            return u.upper()
    return 'UN'


def parse_marca(nombre: str) -> str:
    base = re.split(r'\bx\b', nombre, flags=re.IGNORECASE)[0]
    tokens = [t for t in re.split(r'\s+', base.strip()) if t]
    return ' '.join(tokens[:2]).strip()[:80] if tokens else 'SIN MARCA'


def parse_categoria(nombre: str) -> str:
    n = nombre.lower()
    if 'sustrato' in n or 'tierra' in n:
        return 'SUSTRATOS'
    if 'repelente' in n or 'replente' in n:
        return 'REPELENTES'
    if 'fung' in n:
        return 'FUNGICIDAS'
    if 'herbi' in n or '24d' in n:
        return 'HERBICIDAS'
    return 'GENERAL'


def to_float(raw):
    if raw is None:
        return None
    s = str(raw).strip().replace(',', '.')
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def run():
    if not XLSX_PATH.exists():
        raise FileNotFoundError(f'No existe {XLSX_PATH}')
    db_path = next((p for p in DB_PATHS if p.exists()), None)
    if not db_path:
        raise FileNotFoundError(f'No existe ninguna DB esperada: {DB_PATHS}')

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    imported = 0
    skipped = 0
    errors = []

    for idx, row in enumerate(read_first_sheet_rows(XLSX_PATH), start=1):
        nombre = (row.get('D') or '').strip()
        precio_pesos = to_float(row.get('A'))
        precio_usd = to_float(row.get('B'))

        if not nombre or (precio_pesos is None and precio_usd is None):
            skipped += 1
            continue

        marca = parse_marca(nombre)
        unidad = detect_unidad(nombre)
        categoria = parse_categoria(nombre)
        stock = 0

        try:
            cur.execute(
                'SELECT id FROM Producto WHERE lower(trim(nombre))=lower(trim(?)) AND lower(trim(marca))=lower(trim(?)) AND lower(trim(unidad))=lower(trim(?)) LIMIT 1',
                (nombre, marca, unidad)
            )
            if cur.fetchone():
                skipped += 1
                continue

            cur.execute(
                '''INSERT INTO Producto
                (nombre, categoria, marca, unidad, stock, monedaCosto, costoBase, precioVenta, porcentajeUva, porcentajeFlete, porcentajeGanancia, precioFinalPesos, precioUsd, activo, eliminado)
                VALUES (?, ?, ?, ?, ?, 'USD', 0, ?, 0, 0, 0, ?, ?, 1, 0)''',
                (nombre, categoria, marca, unidad, stock, precio_pesos or 0, precio_pesos or 0, precio_usd)
            )
            imported += 1
        except Exception as e:
            errors.append(f'Fila {idx}: {e}')

    conn.commit()
    conn.close()

    print('=== RESUMEN IMPORTACION ===')
    print(f'Importados: {imported}')
    print(f'Omitidos: {skipped}')
    print(f'Errores: {len(errors)}')
    for err in errors[:20]:
        print(f'- {err}')


if __name__ == '__main__':
    run()
