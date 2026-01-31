
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('fr-FR').format(value);
};

export const generateInvoiceNumber = (): string => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `F-${year}${random}`;
};

export const numberToWords = (n: number): string => {
  if (n === 0) return "Zéro Franc CFA";

  const units = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf"];
  const teens = ["dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
  const tens = ["", "dix", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante-dix", "quatre-vingt", "quatre-vingt-dix"];

  const convertGroup = (num: number): string => {
    let res = "";
    if (num >= 100) {
      const h = Math.floor(num / 100);
      if (h > 1) {
        res += units[h] + " cent" + (num % 100 === 0 ? "s" : "") + " ";
      } else {
        res += "cent ";
      }
      num %= 100;
    }

    if (num >= 20) {
      const t = Math.floor(num / 10);
      const u = num % 10;
      if (t === 7) {
        res += "soixante " + (u === 1 ? "et " : "") + teens[u];
      } else if (t === 9) {
        res += "quatre-vingt-" + teens[u];
      } else {
        res += tens[t] + (u === 1 && t !== 8 ? " et " : (u !== 0 ? "-" : "")) + units[u];
      }
    } else if (num >= 10) {
      res += teens[num - 10];
    } else {
      res += units[num];
    }
    return res.trim();
  };

  let result = "";
  let temp = n;

  if (temp >= 1000000) {
    const m = Math.floor(temp / 1000000);
    result += convertGroup(m) + " million" + (m > 1 ? "s" : "") + " ";
    temp %= 1000000;
  }

  if (temp >= 1000) {
    const k = Math.floor(temp / 1000);
    if (k === 1) {
      result += "mille ";
    } else {
      result += convertGroup(k) + " mille ";
    }
    temp %= 1000;
  }

  if (temp > 0) {
    result += convertGroup(temp);
  }

  const final = result.trim();
  const capitalized = final.charAt(0).toUpperCase() + final.slice(1);
  
  return `${capitalized} Francs CFA`;
};
