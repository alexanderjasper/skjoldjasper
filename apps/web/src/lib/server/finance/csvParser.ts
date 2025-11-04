export interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
}

export class CsvParseError extends Error {
  constructor(message: string, public line?: number) {
    super(message);
    this.name = 'CsvParseError';
  }
}

export function parseDanishBankCsv(content: string): ParsedTransaction[] {
  const lines = content.trim().split('\n');
  const transactions: ParsedTransaction[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(';');
    if (parts.length < 3) {
      throw new CsvParseError(`Invalid format: expected at least 3 columns`, i + 1);
    }

    const [dateStr, description, amountStr] = parts;

    if (!dateStr || !description || !amountStr) {
      throw new CsvParseError(`Missing required field`, i + 1);
    }

    const amount = parseDanishNumber(amountStr);
    if (isNaN(amount)) {
      throw new CsvParseError(`Invalid amount: ${amountStr}`, i + 1);
    }

    transactions.push({
      date: dateStr.trim(),
      description: description.trim(),
      amount
    });
  }

  return transactions;
}

function parseDanishNumber(str: string): number {
  const cleaned = str.trim().replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned);
}

