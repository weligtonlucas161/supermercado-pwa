/**
 * Categorização automática de produtos de supermercado.
 *
 * O objetivo é transformar descrições curtas/abreviadas de ERP/PDV
 * (ex.: "REF COCA LT 350", "DET YPE 500ML") na categoria/departamento
 * comercial correspondente (ex.: "Bebidas Não Alcoólicas", "Limpeza").
 *
 * Regras:
 * 1. Normaliza a descrição (maiúsculas, sem acentos/pontuação).
 * 2. Expande siglas e abreviações comuns de ERP/PDV.
 * 3. Aplica regras de palavra/frase inteira com prioridade para regras
 *    customizadas da loja e depois para as regras padrão.
 * 4. Mantém "Outros" como fallback seguro.
 */

export const PRODUCT_CATEGORIES = [
  'Bebê e Infantil',
  'Pet Shop',
  'Higiene Pessoal e Perfumaria',
  'Limpeza',
  'Bebidas Alcoólicas',
  'Bebidas Não Alcoólicas',
  'Laticínios',
  'Frios e Embutidos',
  'Açougue/Aves/Peixaria',
  'Congelados',
  'Padaria e Confeitaria',
  'Biscoitos/Doces/Matinal',
  'Hortifrúti',
  'Mercearia e Grãos',
  'Descartáveis e Utilidades',
  'Outros',
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export type CategoryRules = Record<string, ProductCategory>;

/**
 * Expansão de siglas/abreviações comuns em exportações de ERP/PDV.
 * A chave deve estar sem acentos e em maiúsculas (texto já normalizado).
 */
const ABBREVIATIONS: Record<string, string> = {
  REF: 'REFRIGERANTE',
  REFRIG: 'REFRIGERANTE',
  DET: 'DETERGENTE',
  LT: 'LEITE',
  QJ: 'QUEIJO',
  ARR: 'ARROZ',
  FJ: 'FEIJAO',
  BISC: 'BISCOITO',
  BOL: 'BOLACHA',
  SAB: 'SABAO',
  SH: 'SHAMPOO',
  FRG: 'FRANGO',
  BOV: 'BOVINO',
  CERV: 'CERVEJA',
  VINH: 'VINHO',
  OLE: 'OLEO',
  MAC: 'MACARRAO',
  PAO: 'PAO',
  FRUT: 'FRUTA',
  LEG: 'LEGUME',
  AMAC: 'AMACIANTE',
  DESINF: 'DESINFETANTE',
  SABON: 'SABONETE',
  COND: 'CONDICIONADOR',
  DESOD: 'DESODORANTE',
  IOG: 'IOGURTE',
  MANT: 'MANTEIGA',
  REQ: 'REQUEIJAO',
  PRES: 'PRESUNTO',
  MORT: 'MORTADELA',
  SALAM: 'SALAME',
  PIZ: 'PIZZA',
  SORV: 'SORVETE',
  CHOCO: 'CHOCOLATE',
  TOM: 'TOMATE',
  CEB: 'CEBOLA',
  BAT: 'BATATA',
  ALF: 'ALFACE',
  BAN: 'BANANA',
  LAR: 'LARANJA',
  LIM: 'LIMAO',
  ACUC: 'ACUCAR',
  FAR: 'FARINHA',
  MOL: 'MOLHO',
  MIL: 'MILHO',
  ERV: 'ERVILHA',
  GUARD: 'GUARDANAPO',
  DESC: 'DESCARTAVEL',
};

/**
 * Regras padrão por departamento. A ordem importa: categorias mais
 * específicas devem vir antes das mais genéricas.
 */
const CATEGORY_RULES: Record<ProductCategory, string[]> = {
  'Bebê e Infantil': [
    'FRALDA',
    'MAMADEIRA',
    'PAPINHA',
    'CHUPETA',
    'TALCO BEBE',
    'LENCO UMEDECIDO',
    'BEBE',
    'INFANTIL',
    'FORMULA INFANTIL',
  ],
  'Pet Shop': [
    'RACAO',
    'PET',
    'GATO',
    'CACHORRO',
    'AREIA GATOS',
    'AREIA HIGIENICA',
    'BRINQUEDO PET',
    'PETISCO',
    'OSSO',
  ],
  'Higiene Pessoal e Perfumaria': [
    'SABONETE',
    'SHAMPOO',
    'CONDICIONADOR',
    'DESODORANTE',
    'CREME DENTAL',
    'ESCOVA DENTE',
    'FIO DENTAL',
    'ENXAGUANTE',
    'PERFUME',
    'COLONIA',
    'ALGODAO',
    'ABSORVENTE',
    'FRALDA GERIATRICA',
    'BARBEADOR',
    'LAMINA',
    'HIDRATANTE',
    'PROTETOR SOLAR',
    'MAQUIAGEM',
    'HIGIENE',
    'COTONETE',
    'ESCOVA DE CABELO',
  ],
  Limpeza: [
    'DETERGENTE',
    'SABAO EM PO',
    'SABAO LIQUIDO',
    'AMACIANTE',
    'DESINFETANTE',
    'AGUA SANITARIA',
    'CLORO',
    'ALCOOL',
    'LIMPADOR',
    'ESPONJA',
    'SABAO',
    'MULTIUSO',
    'DESENGORDURANTE',
    'REMOVEDOR',
    'CERA',
    'SACO DE LIXO',
    'VASSOURA',
    'RODO',
    'LIMPADOR DE PISO',
  ],
  'Bebidas Alcoólicas': [
    'CERVEJA',
    'CHOPP',
    'VINHO',
    'VODKA',
    'WHISKY',
    'UISQUE',
    'GIN',
    'CACHACA',
    'SPUMANTE',
    'ESPUMANTE',
    'LICOR',
    'TEQUILA',
    'RUM',
    'SAQUE',
    'BEBIDA ALCoolICA',
  ],
  'Bebidas Não Alcoólicas': [
    'REFRIGERANTE',
    'SUCO',
    'AGUA MINERAL',
    'AGUA COM GAS',
    'AGUA TONICA',
    'TONICA',
    'ENERGETICO',
    'ISOTONICO',
    'CHA',
    'CHAS',
    'REFRESCO',
    'XAROPE',
  ],
  Laticínios: [
    'LEITE',
    'IOGURTE',
    'QUEIJO',
    'MANTEIGA',
    'CREME DE LEITE',
    'REQUEIJAO',
    'COALHADA',
    'MUSSARELA',
    'PRATO',
    'PARMESAO',
    'RICOTA',
    'LEITE CONDENSADO',
    'LEITE EM PO',
    'BEBIDA LACTEA',
  ],
  'Frios e Embutidos': [
    'PRESUNTO',
    'SALAME',
    'MORTADELA',
    'COPPA',
    'APRESUNTADO',
    'LINGUICA',
    'SALSICHA',
    'BOLONHA',
    'PEITO DE PERU',
    'BLANQUET',
  ],
  'Açougue/Aves/Peixaria': [
    'CARNE',
    'FRANGO',
    'BOVINO',
    'SUINO',
    'PEIXE',
    'CAMARAO',
    'COSTELA',
    'ALCATRA',
    'PICANHA',
    'PATO',
    'PERU',
    'FILE',
    'MOIDA',
    'ACEM',
    'LOMBO',
    'BACON',
    'CALABRESA',
    'TILAPIA',
    'SALMAO',
  ],
  Congelados: [
    'PIZZA CONGELADA',
    'LASANHA CONGELADA',
    'NUGGETS',
    'BATATA CONGELADA',
    'SORVETE',
    'GELO',
    'CONGELADO',
    'HAMBURGUER CONGELADO',
    'POLPA CONGELADA',
  ],
  'Padaria e Confeitaria': [
    'PAO',
    'BOLO',
    'TORRADA',
    'SONHO',
    'CROISSANT',
    'CONFEITARIA',
    'ROSCA',
    'BISNAGA',
    'PÃO DE QUEIJO',
    'BAGUETE',
    'DOCE DE PADARIA',
  ],
  'Biscoitos/Doces/Matinal': [
    'BISCOITO',
    'BOLACHA',
    'CHOCOLATE',
    'BALA',
    'GOMA',
    'CEREAL',
    'GRANOLA',
    'GELEIA',
    'MEL',
    'ACHOCOLATADO',
    'CAFE',
    'CAPSULA DE CAFE',
    'CHÁ',
    'WAFFER',
    'COOKIE',
    'BOMBOM',
    'PASTA DE AMENDOIM',
  ],
  Hortifrúti: [
    'TOMATE',
    'CEBOLA',
    'BATATA',
    'ALFACE',
    'BANANA',
    'MACA',
    'LARANJA',
    'LIMAO',
    'MAMAO',
    'MELANCIA',
    'MELAO',
    'UVA',
    'PERA',
    'PEPINO',
    'CENOURA',
    'ABOBORA',
    'ABOBRINHA',
    'BRACOLIS',
    'BROCOLIS',
    'COUVE',
    'REPOLHO',
    'LEGUME',
    'FRUTA',
    'VERDURA',
  ],
  'Mercearia e Grãos': [
    'ARROZ',
    'FEIJAO',
    'MACARRAO',
    'OLEO',
    'AZEITE',
    'SAL',
    'ACUCAR',
    'FARINHA',
    'MOLHO TOMATE',
    'EXTRATO DE TOMATE',
    'MILHO',
    'ERVILHA',
    'GRAO DE BICO',
    'LENTILHA',
    'ATUM',
    'SARDINHA',
    'PESSEGO EM CALDA',
    'GOIABADA',
    'DOCE EM COMPOTA',
    'VINAGRE',
    'MAIONESE',
    'KETCHUP',
    'MOSTARDA',
    'TEMPERO',
    'CALDO',
    'PIPOCA',
    'AMENDOIM',
    'CASTANHA',
    'NOZ',
    'AVEIA',
    'QUINOA',
    'FAROFA',
    'COCO',
    'LEITE DE COCO',
    'BEBIDA VEGETAL',
    'MASSA',
    'LAMEN',
    'YAKISSOBA',
  ],
  'Descartáveis e Utilidades': [
    'COPO DESCARTAVEL',
    'PRATO DESCARTAVEL',
    'GUARDANAPO',
    'PAPEL ALUMINIO',
    'PLASTICO FILME',
    'VELA',
    'PILHA',
    'LANTERNA',
    'FOSFORO',
    'ISQUEIRO',
    'SACO ZIP',
    'POTE DESCARTAVEL',
    'TALHER DESCARTAVEL',
    'EMBALAGEM',
    'UTILIDADE',
    'BAZAR',
  ],
  Outros: [],
};

const STOP_WORDS = new Set([
  'DE', 'DA', 'DO', 'DAS', 'DOS', 'COM', 'SEM', 'E', 'A', 'O', 'AS', 'OS',
  'EM', 'NO', 'NA', 'NOS', 'NAS', 'PARA', 'POR', 'TIPO', 'SABOR', 'SORTIDO',
  'TRADICIONAL', 'ORIGINAL', 'INTEGRAL', 'DESNATADO', 'SEMIDESNATADO',
  'UN', 'UND', 'UNIDADE', 'UNIDADES', 'CX', 'CAIXA', 'PCT', 'PACOTE',
  'KG', 'G', 'GR', 'ML', 'L', 'LT', 'LITRO', 'LITROS', 'GARRAFA',
  'LATA', 'FRASCO', 'POTE', 'SACHE', 'SACHET', 'DISPLAY', 'FARDO',
  'PRODUTO', 'PRODUTOS', 'ITEM', 'ITENS', 'MERCADORIA', 'ESTOQUE',
  'PESO', 'LIQUIDO', 'SOLIDO', 'CONTEUDO', 'EMBALAGEM', 'PACK',
  'GRANDE', 'PEQUENO', 'MEDIO', 'EXTRA', 'SUPER', 'PREMIUM',
]);

const GENERIC_CATEGORIES = new Set([
  'GERAL',
  'OUTROS',
  'OUTRO',
  'SEM CATEGORIA',
  'NAO INFORMADO',
  'NAO INFORMADA',
  'NÃO INFORMADO',
  'NÃO INFORMADA',
  'DIVERSOS',
  'DIVERSAS',
  'ESTOQUE',
  'PRODUTOS',
  'PRODUTO',
  'MERCADORIAS',
  'ALIMENTOS',
  'BAZAR GERAL',
  'NA',
  'N A',
  'N/A',
  'SEM SETOR',
  '-',
]);

const CATEGORY_ABBREVIATIONS: Record<string, ProductCategory> = {
  BEB: 'Bebidas Não Alcoólicas',
  BEBIDA: 'Bebidas Não Alcoólicas',
  BEBIDAS: 'Bebidas Não Alcoólicas',
  REFRIG: 'Bebidas Não Alcoólicas',
  REFRIGERANTE: 'Bebidas Não Alcoólicas',
  ALC: 'Bebidas Alcoólicas',
  ALCOOLICA: 'Bebidas Alcoólicas',
  ALCOOLICAS: 'Bebidas Alcoólicas',
  LIMP: 'Limpeza',
  LIMPEZA: 'Limpeza',
  HIG: 'Higiene Pessoal e Perfumaria',
  HIGIENE: 'Higiene Pessoal e Perfumaria',
  PERFUMARIA: 'Higiene Pessoal e Perfumaria',
  LATIC: 'Laticínios',
  LATICINIOS: 'Laticínios',
  FRIOS: 'Frios e Embutidos',
  EMBUTIDOS: 'Frios e Embutidos',
  ACOUGUE: 'Açougue/Aves/Peixaria',
  AVES: 'Açougue/Aves/Peixaria',
  PEIXARIA: 'Açougue/Aves/Peixaria',
  CONG: 'Congelados',
  CONGELADOS: 'Congelados',
  PAD: 'Padaria e Confeitaria',
  PADARIA: 'Padaria e Confeitaria',
  CONFEITARIA: 'Padaria e Confeitaria',
  BISC: 'Biscoitos/Doces/Matinal',
  BISCOITOS: 'Biscoitos/Doces/Matinal',
  DOCES: 'Biscoitos/Doces/Matinal',
  MATINAL: 'Biscoitos/Doces/Matinal',
  HORT: 'Hortifrúti',
  HORTIFRUTI: 'Hortifrúti',
  MERC: 'Mercearia e Grãos',
  MERCEARIA: 'Mercearia e Grãos',
  GRAOS: 'Mercearia e Grãos',
  DESC: 'Descartáveis e Utilidades',
  DESCARTAVEIS: 'Descartáveis e Utilidades',
  UTILIDADES: 'Descartáveis e Utilidades',
  PET: 'Pet Shop',
  INF: 'Bebê e Infantil',
  INFANTIL: 'Bebê e Infantil',
  BEBE: 'Bebê e Infantil',
};

/**
 * Normaliza uma descrição: maiúsculas, sem acentos/pontuação, com
 * expansão de siglas e limpeza de espaços.
 */
export function normalizeDescription(description: string): string {
  if (!description) return '';

  let normalized = String(description).toUpperCase();

  // Remove acentos
  normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Troca pontuação por espaço (preserva letras/números)
  normalized = normalized.replace(/[^A-Z0-9\s]/g, ' ');

  // Expande siglas palavra por palavra
  const words = normalized.split(/\s+/).filter(Boolean);
  const expandedWords = words.map(word => ABBREVIATIONS[word] || word);

  return expandedWords.join(' ').replace(/\s+/g, ' ').trim();
}

/** Verifica se a categoria informada é vazia ou genérica. */
export function isGenericCategory(category?: string | null): boolean {
  const normalized = normalizeDescription(category || '');
  if (!normalized) return true;
  return GENERIC_CATEGORIES.has(normalized);
}

/** Converte abreviações de categoria em departamentos completos. */
function expandCategoryAbbreviation(normalizedCategory: string): ProductCategory | null {
  return CATEGORY_ABBREVIATIONS[normalizedCategory] || null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesKeyword(normalizedText: string, keyword: string): boolean {
  const normalizedKeyword = normalizeDescription(keyword);
  if (!normalizedKeyword) return false;
  const regex = new RegExp(`(?:^|\\s)${escapeRegExp(normalizedKeyword)}(?:$|\\s)`, 'i');
  return regex.test(normalizedText);
}

/**
 * Categoriza uma descrição de produto nas regras padrão + regras da loja.
 * As regras customizadas têm prioridade máxima.
 */
export function categorizeProduct(
  productName: string,
  customRules?: CategoryRules | null
): ProductCategory {
  const normalized = normalizeDescription(productName);
  if (!normalized) return 'Outros';

  // 1. Regras customizadas da loja (maior prioridade)
  if (customRules) {
    for (const [keyword, category] of Object.entries(customRules)) {
      if (matchesKeyword(normalized, keyword)) {
        return category;
      }
    }
  }

  // 2. Regras padrão por departamento
  for (const category of PRODUCT_CATEGORIES) {
    if (category === 'Outros') continue;
    const keywords = CATEGORY_RULES[category] || [];
    for (const keyword of keywords) {
      if (matchesKeyword(normalized, keyword)) {
        return category;
      }
    }
  }

  return 'Outros';
}

/**
 * Resolve a categoria final de um item importado.
 *
 * - Categoria vazia, genérica ou abreviada => categorização automática.
 * - Categoria já reconhecida (ex.: "Laticínios") => mantém a informada.
 */
export function resolveCategory(
  rawCategory: string | undefined | null,
  productName: string,
  customRules?: CategoryRules | null
): ProductCategory {
  const normalized = normalizeDescription(rawCategory || '');

  if (normalized && !GENERIC_CATEGORIES.has(normalized)) {
    const exact = PRODUCT_CATEGORIES.find(
      category => normalizeDescription(category) === normalized
    );
    if (exact) return exact;

    const abbreviated = expandCategoryAbbreviation(normalized);
    if (abbreviated) return abbreviated;
  }

  return categorizeProduct(productName, customRules);
}

/**
 * Extrai a palavra-chave principal do produto para alimentar o dicionário
 * customizado da loja após uma correção manual de categoria.
 */
export function extractPrimaryKeyword(
  productName: string,
  category: ProductCategory = 'Outros'
): string {
  const normalized = normalizeDescription(productName);
  if (!normalized) return '';

  const words = normalized
    .split(' ')
    .filter(word => {
      if (!word || word.length < 3) return false;
      if (STOP_WORDS.has(word)) return false;
      if (/^\d+$/.test(word)) return false;
      if (/^\d+(ML|L|G|KG|UN|UND|CX|PCT|MG)$/.test(word)) return false;
      return true;
    });

  if (words.length === 0) return '';

  const categoryKeywords = new Set(
    (CATEGORY_RULES[category] || [])
      .flatMap(keyword => normalizeDescription(keyword).split(' '))
      .filter(Boolean)
  );

  const matching = words.filter(word => categoryKeywords.has(word));
  if (matching.length > 0) {
    return matching.sort((a, b) => b.length - a.length)[0];
  }

  // Fallback: maior palavra significativa (normalmente o substantivo principal).
  return [...words].sort((a, b) => b.length - a.length)[0];
}
