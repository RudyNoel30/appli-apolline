import ExcelJS from 'exceljs'
import { saveFile, FILTERS } from './saveFile'

export type ColumnDef = {
  key: string
  header: string
  width?: number
  format?: 'text' | 'currency' | 'percent' | 'number' | 'date' | 'integer'
  align?: 'left' | 'right' | 'center'
  conditionalBg?: (value: any, row: any) => string | null
  conditionalColor?: (value: any, row: any) => string | null
}

export type SheetDef = {
  name: string
  columns: ColumnDef[]
  rows: Record<string, any>[]
  title?: string
  subtitle?: string
  /** Ajoute une ligne de totaux (somme des colonnes marquées), en or */
  totals?: { label: string; sumKeys: string[] }
}

// Palette navy-gold Apolline
const NAVY = 'FF0A1F3D'
const NAVY_DARK = 'FF06122A'
const GOLD = 'FFC9A961'
const GOLD_LIGHT = 'FFF6EED3'
const IVORY = 'FFF8F7F3'
const GRAY_LIGHT = 'FFF3F5FA'

function fmtForType(fmt?: string): string | undefined {
  switch (fmt) {
    case 'currency': return '#,##0 "€"'
    case 'percent':  return '0.00%'
    case 'number':   return '#,##0.00'
    case 'integer':  return '#,##0'
    case 'date':     return 'dd/mm/yyyy'
    default:         return undefined
  }
}

function applyCellStyle(cell: ExcelJS.Cell, opts: {
  bg?: string
  color?: string
  bold?: boolean
  align?: 'left' | 'right' | 'center'
  fontSize?: number
  fontFamily?: string
}) {
  if (opts.bg) {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: opts.bg },
    }
  }
  cell.font = {
    bold: opts.bold ?? false,
    color: opts.color ? { argb: opts.color } : undefined,
    size: opts.fontSize,
    name: opts.fontFamily ?? 'Inter',
  }
  cell.alignment = {
    horizontal: opts.align,
    vertical: 'middle',
  }
}

/**
 * Génère un fichier XLSX stylisé navy-gold Apolline.
 * Retourne le chemin sauvegardé, ou null si annulé.
 */
export async function exportToXlsx(opts: {
  filename: string
  sheets: SheetDef[]
}): Promise<string | null> {
  const wb = new ExcelJS.Workbook()
  wb.creator = "Extr'Apol — Groupe Apolline"
  wb.created = new Date()
  wb.company = 'Groupe Apolline'

  for (const sheet of opts.sheets) {
    const ws = wb.addWorksheet(sheet.name, {
      views: [{ state: 'frozen', ySplit: sheet.title ? 4 : 1, zoomScale: 100 }],
      properties: { defaultRowHeight: 20 },
    })

    // Largeurs de colonnes
    ws.columns = sheet.columns.map((c) => ({
      header: c.header,
      key: c.key,
      width: c.width ?? 18,
    }))

    let currentRow = 1

    // Titre de feuille si fourni
    if (sheet.title) {
      ws.mergeCells(currentRow, 1, currentRow, sheet.columns.length)
      const titleCell = ws.getCell(currentRow, 1)
      titleCell.value = sheet.title
      applyCellStyle(titleCell, {
        bg: NAVY,
        color: GOLD,
        bold: true,
        fontSize: 16,
        align: 'left',
        fontFamily: 'Playfair Display',
      })
      ws.getRow(currentRow).height = 32
      currentRow++

      if (sheet.subtitle) {
        ws.mergeCells(currentRow, 1, currentRow, sheet.columns.length)
        const subCell = ws.getCell(currentRow, 1)
        subCell.value = sheet.subtitle
        applyCellStyle(subCell, {
          bg: NAVY_DARK,
          color: 'FFBEC9DF',
          fontSize: 10,
          align: 'left',
        })
        ws.getRow(currentRow).height = 20
        currentRow++
      }

      // Ligne or décorative
      ws.mergeCells(currentRow, 1, currentRow, sheet.columns.length)
      const goldCell = ws.getCell(currentRow, 1)
      applyCellStyle(goldCell, { bg: GOLD })
      ws.getRow(currentRow).height = 4
      currentRow++
    }

    // En-tête des colonnes
    const headerRowNum = currentRow
    sheet.columns.forEach((col, i) => {
      const cell = ws.getCell(headerRowNum, i + 1)
      cell.value = col.header
      applyCellStyle(cell, {
        bg: NAVY,
        color: GOLD,
        bold: true,
        fontSize: 11,
        align: col.align ?? 'left',
      })
      cell.border = {
        bottom: { style: 'medium', color: { argb: GOLD } },
      }
    })
    ws.getRow(headerRowNum).height = 28
    currentRow++

    // Lignes de données
    sheet.rows.forEach((row, rowIdx) => {
      sheet.columns.forEach((col, i) => {
        const cell = ws.getCell(currentRow, i + 1)
        const value = row[col.key]
        cell.value = value

        const fmt = fmtForType(col.format)
        if (fmt) cell.numFmt = fmt

        const isAlt = rowIdx % 2 === 1
        const bg = col.conditionalBg?.(value, row) ?? (isAlt ? GRAY_LIGHT : undefined)
        const color = col.conditionalColor?.(value, row)

        applyCellStyle(cell, {
          bg,
          color: color ?? 'FF1A1A1A',
          align: col.align ?? (col.format === 'currency' || col.format === 'percent' || col.format === 'number' || col.format === 'integer' ? 'right' : 'left'),
          fontSize: 10,
        })
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE3E8F2' } },
        }
      })
      currentRow++
    })

    // Ligne totaux si demandée
    if (sheet.totals) {
      const totals: Record<string, number> = {}
      sheet.totals.sumKeys.forEach((k) => {
        totals[k] = sheet.rows.reduce((s, r) => s + (Number(r[k]) || 0), 0)
      })
      sheet.columns.forEach((col, i) => {
        const cell = ws.getCell(currentRow, i + 1)
        if (i === 0) {
          cell.value = sheet.totals!.label
        } else if (sheet.totals!.sumKeys.includes(col.key)) {
          cell.value = totals[col.key]
          const fmt = fmtForType(col.format)
          if (fmt) cell.numFmt = fmt
        }
        applyCellStyle(cell, {
          bg: GOLD_LIGHT,
          color: 'FF3A2D14',
          bold: true,
          fontSize: 11,
          align: col.align ?? (col.format === 'currency' ? 'right' : 'left'),
        })
        cell.border = {
          top: { style: 'medium', color: { argb: GOLD } },
        }
      })
      ws.getRow(currentRow).height = 26
      currentRow++
    }

    // Ligne vide finale + signature
    currentRow += 1
    ws.mergeCells(currentRow, 1, currentRow, sheet.columns.length)
    const footer = ws.getCell(currentRow, 1)
    footer.value = `Généré par Extr'Apol — Groupe Apolline · ${new Date().toLocaleString('fr-FR')}`
    applyCellStyle(footer, {
      color: 'FF8498BC',
      fontSize: 9,
      align: 'left',
    })
  }

  const buffer = await wb.xlsx.writeBuffer()
  const bytes = new Uint8Array(buffer as ArrayBuffer)

  return saveFile({
    defaultFilename: opts.filename,
    content: bytes,
    filters: [{ name: 'Classeur Excel', extensions: ['xlsx'] }, ...FILTERS.csv],
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}
