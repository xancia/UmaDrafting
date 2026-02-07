/**
 * Icon Mappings - Maps Global cardIds to Japanese icon cardIds
 *
 * Use this when the Global version cardId doesn't match the Japanese icon filename.
 * Key: Global cardId from data
 * Value: Japanese cardId for icon filename
 */
export const cardIdToIconMapping: Record<number, number> = {
  // Special Week
  100102: 100130,
  100103: 100102,

  // Silence Suzuka
  100202: 100230,

  // Tokai Teio
  100303: 100343,

  // Maruzensky
  100402: 100430,
  100403: 100410,

  // Fuji Kiseki
  100502: 100520,

  // Oguri Cap
  100602: 100646,

  // Gold Ship
  100702: 100730,
  100703: 100702,

  // Vodka
  100802: 100846,

  // Daiwa Scarlet
  100902: 100946,

  // Taiki Shuttle
  101002: 101023,

  // Grass Wonder
  101102: 101116,
  101103: 101102,

  // Hishi Amazon
  101202: 101226,

  // Mejiro McQueen
  101303: 101330,

  // El Condor Pasa
  101402: 101416,

  // TM Opera O
  101502: 101510,

  // Symboli Rudolf
  101702: 101743,

  // Air Groove
  101802: 101826,

  // Agnes Digital
  101902: 101940,

  // Seiun Sky
  102002: 102020,

  // Tamamo Cross
  102102: 102143,

  // Fine Motion
  102202: 102226,

  // Biwa Hayahide
  102302: 102346,
  102303: 102302,

  // Mayano Top Gun
  102402: 102426,
  102403: 102440,

  // Manhattan Cafe
  102502: 102513,

  // Mihono Bourbon
  102602: 102613,

  // Mejiro Ryan
  102702: 102713,

  // Mejiro Dober
  102902: 102913,

  // Rice Shower
  103002: 103040,
  103003: 103002,

  // Ines Fujin
  103102: 103113,
  103103: 103102,

  // Agnes Tachyon
  103202: 103230,
  103203: 103202,

  // Admire Vega
  103302: 103346,

  // Inari One
  103402: 103443,

  // Winning Ticket
  103502: 103516,
  103503: 103502,

  // Sakura Bakushin O
  103602: 103640,

  // Seeking the Pearl
  103702: 103713,
  103703: 103730,

  // Shinko Windy
  103802: 103826,

  // Sweep Tosho
  103902: 103943,

  // Gold City
  104002: 104043,
  104003: 104002,

  // Narita Brian
  104102: 104150,

  // Curren Chan
  104202: 104240,

  // Yukino Bijin
  104402: 104426,

  // Super Creek
  104502: 104540,
  104503: 104550,

  // Smart Falcon
  104603: 104650,

  // Zenno Rob Roy
  104702: 104723,

  // Tosen Jordan
  104802: 104823,

  // Narita Top Road
  105002: 105016,
  105003: 105002,

  // Yaeno Muteki
  105102: 105126,

  // Haru Urara
  105202: 105210,

  // T.M. Opera O
  105302: 105323,

  // Matikanefukukitaru
  105602: 105623,

  // Eishin Flash
  105702: 105710,

  // Mejiro Palmer
  105802: 105840,

  // Kawakami Princess
  105902: 105923,

  // Nishino Flower
  106002: 106050,
  106003: 106010,

  // King Halo
  106102: 106150,
  106103: 106126,

  // Narita Taishin
  106202: 106250,

  // Nice Nature
  106402: 106446,

  // Kitasan Black
  106502: 106520,

  // Satono Diamond
  106702: 106710,
  106703: 106702,

  // Mejiro Bright
  106802: 106810,
  106803: 106802,

  // Daitaku Helios
  106902: 106920,

  // Twin Turbo
  107102: 107120,

  // Satono Crown
  107202: 107250,

  // Sakura Chiyono O
  107402: 107446,

  // Sirius Symboli
  107702: 107746,

  // Mejiro Ardan
  107802: 107813,

  // Tanino Gimlet
  108302: 108340,

  // Ikunoudicktick
  108402: 108420,

  // Agnes Flight
  108502: 108520,

  // Meisho Doto
  108602: 108626,

  // Wonder Acute
  108702: 108713,

  // Chuchu Chuchu
  108802: 108830,

  // Machikane Tanhoi Za
  108902: 108930,

  // Neo Universe
  109102: 109130,

  // Hokko Tarumae
  109302: 109323,

  // Dura Mensura
  109802: 109850,

  // Transcend
  109902: 109930,

  // K.S. Miracle
  110402: 110410,

  // Sound Sky
  110502: 110523,

  // Copano Rickey
  110602: 110623,

  // Marvellous Sunday
  110702: 110720,

  // Duramente
  111002: 111026,

  // Add more mappings as needed
  // Format: globalCardId: japaneseIconCardId,
};

/**
 * Gets the correct icon cardId for a given global cardId
 */
export function getIconCardId(globalCardId: number): number {
  return cardIdToIconMapping[globalCardId] ?? globalCardId;
}
