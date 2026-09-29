export const BIBLE_BOOKS = [
  { id: "GEN", name: "Gênesis", apiSlug: "gn", aliases: ["Gênesis", "Genesis", "Gn"] },
  { id: "EXO", name: "Êxodo", apiSlug: "ex", aliases: ["Êxodo", "Exodo", "Êx", "Ex"] },
  { id: "LEV", name: "Levítico", apiSlug: "lv", aliases: ["Levítico", "Levitico", "Lv"] },
  { id: "NUM", name: "Números", apiSlug: "nm", aliases: ["Números", "Numeros", "Nm"] },
  {
    id: "DEU",
    name: "Deuteronômio",
    apiSlug: "dt",
    aliases: ["Deuteronômio", "Deuteronomio", "Dt"],
  },
  { id: "JOS", name: "Josué", apiSlug: "js", aliases: ["Josué", "Josue", "Js"] },
  { id: "JDG", name: "Juízes", apiSlug: "jz", aliases: ["Juízes", "Juizes", "Jz"] },
  { id: "RUT", name: "Rute", apiSlug: "rt", aliases: ["Rute", "Rt"] },
  { id: "1SA", name: "1 Samuel", apiSlug: "1sm", aliases: ["1 Samuel", "1 Sm", "1Sm"] },
  { id: "2SA", name: "2 Samuel", apiSlug: "2sm", aliases: ["2 Samuel", "2 Sm", "2Sm"] },
  { id: "1KI", name: "1 Reis", apiSlug: "1rs", aliases: ["1 Reis", "1 Rs", "1Rs"] },
  { id: "2KI", name: "2 Reis", apiSlug: "2rs", aliases: ["2 Reis", "2 Rs", "2Rs"] },
  {
    id: "1CH",
    name: "1 Crônicas",
    apiSlug: "1cr",
    aliases: ["1 Crônicas", "1 Cronicas", "1 Cr", "1Cr"],
  },
  {
    id: "2CH",
    name: "2 Crônicas",
    apiSlug: "2cr",
    aliases: ["2 Crônicas", "2 Cronicas", "2 Cr", "2Cr"],
  },
  { id: "EZR", name: "Esdras", apiSlug: "ed", aliases: ["Esdras", "Ed"] },
  { id: "NEH", name: "Neemias", apiSlug: "ne", aliases: ["Neemias", "Ne"] },
  { id: "EST", name: "Ester", apiSlug: "et", aliases: ["Ester", "Et"] },
  { id: "JOB", name: "Jó", apiSlug: "job", aliases: ["Jó", "Job"] },
  { id: "PSA", name: "Salmos", apiSlug: "sl", aliases: ["Salmos", "Salmo", "Sl"] },
  { id: "PRO", name: "Provérbios", apiSlug: "pv", aliases: ["Provérbios", "Proverbios", "Pv"] },
  { id: "ECC", name: "Eclesiastes", apiSlug: "ec", aliases: ["Eclesiastes", "Ec"] },
  {
    id: "SNG",
    name: "Cânticos",
    apiSlug: "ct",
    aliases: ["Cânticos", "Canticos", "Cântico dos Cânticos", "Ct"],
  },
  { id: "ISA", name: "Isaías", apiSlug: "is", aliases: ["Isaías", "Isaias", "Is"] },
  { id: "JER", name: "Jeremias", apiSlug: "jr", aliases: ["Jeremias", "Jr"] },
  { id: "LAM", name: "Lamentações", apiSlug: "lm", aliases: ["Lamentações", "Lamentacoes", "Lm"] },
  { id: "EZK", name: "Ezequiel", apiSlug: "ez", aliases: ["Ezequiel", "Ez"] },
  { id: "DAN", name: "Daniel", apiSlug: "dn", aliases: ["Daniel", "Dn"] },
  { id: "HOS", name: "Oséias", apiSlug: "os", aliases: ["Oséias", "Oseias", "Os"] },
  { id: "JOL", name: "Joel", apiSlug: "jl", aliases: ["Joel", "Jl"] },
  { id: "AMO", name: "Amós", apiSlug: "am", aliases: ["Amós", "Amos", "Am"] },
  { id: "OBA", name: "Obadias", apiSlug: "ob", aliases: ["Obadias", "Ob"] },
  { id: "JON", name: "Jonas", apiSlug: "jn", aliases: ["Jonas", "Jn"] },
  { id: "MIC", name: "Miqueias", apiSlug: "mq", aliases: ["Miqueias", "Mq"] },
  { id: "NAM", name: "Naum", apiSlug: "na", aliases: ["Naum", "Na"] },
  { id: "HAB", name: "Habacuque", apiSlug: "hc", aliases: ["Habacuque", "Hc"] },
  { id: "ZEP", name: "Sofonias", apiSlug: "sf", aliases: ["Sofonias", "Sf"] },
  { id: "HAG", name: "Ageu", apiSlug: "ag", aliases: ["Ageu", "Ag"] },
  { id: "ZEC", name: "Zacarias", apiSlug: "zc", aliases: ["Zacarias", "Zc"] },
  { id: "MAL", name: "Malaquias", apiSlug: "ml", aliases: ["Malaquias", "Ml"] },
  { id: "MAT", name: "Mateus", apiSlug: "mt", aliases: ["Mateus", "Mt"] },
  { id: "MRK", name: "Marcos", apiSlug: "mc", aliases: ["Marcos", "Mc"] },
  { id: "LUK", name: "Lucas", apiSlug: "lc", aliases: ["Lucas", "Lc"] },
  { id: "JHN", name: "João", apiSlug: "jo", aliases: ["João", "Joao", "Jo"] },
  { id: "ACT", name: "Atos", apiSlug: "at", aliases: ["Atos", "At"] },
  { id: "ROM", name: "Romanos", apiSlug: "rm", aliases: ["Romanos", "Rm"] },
  {
    id: "1CO",
    name: "1 Coríntios",
    apiSlug: "1co",
    aliases: ["1 Coríntios", "1 Corintios", "1 Co", "1Co", "1 Cor", "1Cor"],
  },
  {
    id: "2CO",
    name: "2 Coríntios",
    apiSlug: "2co",
    aliases: ["2 Coríntios", "2 Corintios", "2 Co", "2Co", "2 Cor", "2Cor"],
  },
  { id: "GAL", name: "Gálatas", apiSlug: "gl", aliases: ["Gálatas", "Galatas", "Gl"] },
  { id: "EPH", name: "Efésios", apiSlug: "ef", aliases: ["Efésios", "Efesios", "Ef"] },
  { id: "PHP", name: "Filipenses", apiSlug: "fp", aliases: ["Filipenses", "Fp"] },
  { id: "COL", name: "Colossenses", apiSlug: "cl", aliases: ["Colossenses", "Cl"] },
  {
    id: "1TH",
    name: "1 Tessalonicenses",
    apiSlug: "1ts",
    aliases: ["1 Tessalonicenses", "1 Ts", "1Ts"],
  },
  {
    id: "2TH",
    name: "2 Tessalonicenses",
    apiSlug: "2ts",
    aliases: ["2 Tessalonicenses", "2 Ts", "2Ts"],
  },
  {
    id: "1TI",
    name: "1 Timóteo",
    apiSlug: "1tm",
    aliases: ["1 Timóteo", "1 Timoteo", "1 Tm", "1Tm"],
  },
  {
    id: "2TI",
    name: "2 Timóteo",
    apiSlug: "2tm",
    aliases: ["2 Timóteo", "2 Timoteo", "2 Tm", "2Tm"],
  },
  { id: "TIT", name: "Tito", apiSlug: "tt", aliases: ["Tito", "Tt"] },
  { id: "PHM", name: "Filemom", apiSlug: "fm", aliases: ["Filemom", "Fm"] },
  { id: "HEB", name: "Hebreus", apiSlug: "hb", aliases: ["Hebreus", "Hb"] },
  { id: "JAS", name: "Tiago", apiSlug: "tg", aliases: ["Tiago", "Tg"] },
  { id: "1PE", name: "1 Pedro", apiSlug: "1pe", aliases: ["1 Pedro", "1 Pe", "1Pe"] },
  { id: "2PE", name: "2 Pedro", apiSlug: "2pe", aliases: ["2 Pedro", "2 Pe", "2Pe"] },
  { id: "1JN", name: "1 João", apiSlug: "1jo", aliases: ["1 João", "1 Joao", "1 Jo", "1Jo"] },
  { id: "2JN", name: "2 João", apiSlug: "2jo", aliases: ["2 João", "2 Joao", "2 Jo", "2Jo"] },
  { id: "3JN", name: "3 João", apiSlug: "3jo", aliases: ["3 João", "3 Joao", "3 Jo", "3Jo"] },
  { id: "JUD", name: "Judas", apiSlug: "jd", aliases: ["Judas", "Jd"] },
  { id: "REV", name: "Apocalipse", apiSlug: "ap", aliases: ["Apocalipse", "Ap"] },
] as const;

export type BibleBook = (typeof BIBLE_BOOKS)[number];
export type BibleBookId = BibleBook["id"];

function normalizeAlias(value: string): string {
  return value.toLocaleLowerCase("pt-BR").replace(/[.\s]/g, "");
}

const BOOK_BY_ID = new Map<BibleBookId, BibleBook>(BIBLE_BOOKS.map((book) => [book.id, book]));

const BOOK_BY_ALIAS = new Map<string, BibleBook>(
  BIBLE_BOOKS.flatMap((book) =>
    book.aliases.map((alias) => [normalizeAlias(alias), book] as const),
  ),
);

export function getBibleBookById(id: BibleBookId): BibleBook {
  const book = BOOK_BY_ID.get(id);
  if (!book) {
    throw new Error(`Unknown Bible book id: ${id}`);
  }

  return book;
}

export function getBibleBookByAlias(alias: string): BibleBook | undefined {
  return BOOK_BY_ALIAS.get(normalizeAlias(alias));
}
