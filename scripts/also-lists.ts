/**
 * Decisiones sobre qué palabras de un perfil también son aptas para otros (campo `also`).
 * Criterio: una palabra se comparte solo si alguien de esa edad la conocería o la reconocería sin esfuerzo
 * (clásicos que siguen vivos, cultura de su época y el vocabulario que ya ha pasado por la escuela).
 * Lo muy propio de una edad (argot juvenil reciente, recuerdos de los 80, preescolar) no se comparte, y a los
 * adolescentes no se les baja contenido pensado para adultos (violencia, humor adulto, series para mayores).
 *
 * Cada regla elige palabras del perfil `from` y las abre a los perfiles de `to`.
 * Se puede ampliar y volver a ejecutar `npm run apply-also`: es idempotente.
 */
import type { Profile } from '../src/core/types'

export interface Rule {
  label: string
  from: Profile
  to: Profile[]
  /** Todo el vocabulario formal (sin cultura pop). */
  formal?: boolean
  /** Con `formal`, se descartan las que mencionan estos contextos en su definición. */
  skipDefinition?: RegExp
  /** Con `formal`, palabras que el banco marca como no pop pero son de su época o de su jerga y no deben compartirse. */
  skipNames?: string[]
  /** Toda la cultura pop salvo las nombradas en `except`. */
  popAll?: boolean
  except?: string[]
  /** Palabras concretas, por su texto. */
  names?: string[]
  /** Palabras concretas, por su id. */
  ids?: number[]
}

const SCHOOL = /instituto|colegio|profesor|alumn|\bclases?\b|examen|deberes|estudiante|bachillerato|asignatura|\bcole\b/i
/** Referencias a épocas pasadas que en el banco de adultos no están marcadas como cultura pop. */
const ERA = /a[nñ]os (setenta|ochenta|noventa)|d[eé]cada de|\bBUP\b|\bEGB\b|Verano Azul|Sésamo|\bTVE\b/i

/** Palabras «formales» de adultos que son en realidad recuerdos de su época. */
const ADULTS_ERA_WORDS = [
  'Barrio Sésamo', 'Biri Biri', 'Cinema', 'Don Pimpón', 'Fútbol de Primera', 'Gol', 'Goma', 'Hércules', 'Informativo', 'Insignia', 'Javi',
  'Laca', 'Compañía', 'Ochentero', 'Olimpia', 'Operación', 'Química', 'Radioenlace', 'Rock', 'Unicaja', 'V', 'Verano Azul', 'Yuma',
  'Zipi y Zape', 'Zoológico', 'Reválida',
]
/** Palabras «formales» de adolescentes que son jerga o referencias propias de su edad. */
const TEENS_OWN_WORDS = ['Quedada', 'Zona', 'Yate', 'Zombi', 'Instituto']

/** Ids de adultos con cultura pop aptos para jóvenes (revisados uno a uno; ver README de la propuesta). */
const ADULTS_POP_TO_YOUNG = [
  502, 512, 517, 518, 519, 525, 537, 531, 543, 560, 561, 565, 568, 570, 572, 586, 598, 600, 605, 615, 617, 621, 627, 628, 647, 648,
  652, 664, 668, 669, 673, 678, 686, 692, 693, 697, 699, 700, 701, 703, 704, 708, 721, 722, 744,
  854, 857, 858, 859, 860, 1585, 1586, 1591, 1593, 1595, 1615, 1616, 1617, 1619, 1620, 1621, 1644, 1646, 1648, 1672, 1674, 1675,
  1678, 1679, 1681, 1682, 1683, 1703, 1704, 1705, 1707, 1708, 1739, 1742, 1766, 1767, 1768, 1771, 1772, 1773,
  1794, 1795, 1796, 1798, 1799, 1801, 1802, 1804, 1827, 1828, 1829, 1832, 1833, 1835, 1836, 1857, 1858, 1859, 1860, 1863, 1864,
  1865, 1866, 1888, 1889, 1892, 1893, 1897, 1898, 1919, 1920, 1921, 1928, 1950, 1951, 1952, 1953, 1955, 1956, 1957,
  1984, 1985, 1986, 2008, 2012, 2016, 2039, 2040, 2041, 2042, 2044, 2045, 2069, 2078, 2099, 2101, 2102, 2103, 2104, 2105,
  2107, 2108, 2131, 2132, 2133, 2135, 2138, 2143, 2166, 2167, 2168, 2169, 2170, 2171, 2174, 2195, 2198, 2200, 2201, 2202, 2203,
  2204, 2226, 2227, 2228, 2229, 2230, 2234, 2255, 2256, 2260, 2261, 2280, 2282, 2283, 2285, 2286, 2290, 2313, 2314, 2316, 2318,
  2319, 2320, 2321, 2322,
]

export const RULES: Rule[] = [
  // ---- Vocabulario formal: sube de edad (lo estudiado o aprendido antes lo conocen quienes tienen más años)
  { label: 'Vocabulario formal de adolescentes → jóvenes y adultos', from: 'teens', to: ['young', 'adults'], formal: true, skipDefinition: SCHOOL, skipNames: TEENS_OWN_WORDS },
  { label: 'Vocabulario formal de adultos → jóvenes', from: 'adults', to: ['young'], formal: true, skipDefinition: new RegExp(`${ERA.source}|${SCHOOL.source}`, 'i'), skipNames: ADULTS_ERA_WORDS },
  { label: 'Vocabulario formal de jóvenes → adultos', from: 'young', to: ['adults'], formal: true },

  // ---- Cultura pop de adultos que los jóvenes conocen (los 90 en adelante y los clásicos)
  { label: 'Cultura pop de adultos → jóvenes', from: 'adults', to: ['young'], ids: ADULTS_POP_TO_YOUNG },
  {
    label: 'Clásicos atemporales de adultos → adolescentes',
    from: 'adults',
    to: ['teens'],
    names: [
      'Queen', 'Michael Jackson', 'Madonna', 'Superman', 'Tintín', 'Mortadelo', 'Rubik', 'Playmobil', 'Nintendo', 'Tetris', 'Pac-Man',
      'Titanic', 'Terminator', 'Indiana Jones', 'Jurassic Park', 'Rocky', 'Top Gun', 'Ghostbusters', 'Cazafantasmas', 'E.T.', 'Game Boy',
      'Street Fighter', 'Hulk', 'Nirvana', 'Scalextric', 'Delorean', 'Doc Brown', 'Harrison Ford', 'Videojuego',
      'Arcade', 'Recreativos',
    ],
  },

  // ---- Cultura pop de adolescentes
  {
    label: 'Cultura pop de adolescentes → jóvenes',
    from: 'teens',
    to: ['young'],
    names: [
      'Anime', 'Autotune', 'Avatar', 'Chat', 'Cosplay', 'Cringe', 'Crush', 'Directo', 'Discord', 'Emoji', 'Esports', 'Fake', 'Feed', 'Filtro',
      'Follower', 'Gamer', 'Ghosting', 'Goku', 'Hashtag', 'Hater', 'Headset', 'Hype', 'Ibai', 'Instagram', 'Lag', 'Lofi', 'Manga', 'Marvel',
      'Meme', 'Netflix', 'Online', 'Otaku', 'Outfit', 'Platino', 'Play', 'Playlist', 'Podcast', 'Random', 'Reel', 'Shippear', 'Spoiler',
      'Spotify', 'Stalkear', 'Story', 'TikTok', 'Trap', 'Trend', 'Troll', 'Twitch', 'Unbox', 'Vaper', 'Vibe', 'Vlog', 'Tóxico',
      'Attack on Titan', 'Bleach', 'Naruto', 'One Piece', 'Evangelion', 'Yugi', 'Fortnite', 'GTA', 'Zelda', 'Xbox', 'X-Men', 'Matrix',
      'Cyberpunk', 'League of Legends', 'DLC', 'FPS', 'GG', 'Indie', 'Noob', 'Respawn', 'Skin', 'Streamer', 'Rosalía', 'Bad Bunny',
      'J Balvin', 'Ozuna', 'Anuel', 'Duolingo', 'Easter Egg', 'Elden Ring', 'Multiverso', 'IRL', 'Opening', 'Quest', 'Itachi', 'Among Us',
    ],
  },
  {
    label: 'Cultura pop de adolescentes → adultos',
    from: 'teens',
    to: ['adults'],
    names: [
      'Instagram', 'Netflix', 'Spotify', 'TikTok', 'Meme', 'Emoji', 'Chat', 'Online', 'Podcast', 'Marvel', 'Matrix', 'Xbox', 'GTA', 'Zelda',
      'Hashtag', 'Follower', 'Story', 'Playlist', 'Streamer', 'Gamer', 'Avatar', 'Directo', 'Filtro', 'Fake', 'Feed', 'Viral', 'Vlog', 'Troll',
      'Spoiler', 'Ghosting', 'Hater', 'Hype', 'Manga', 'Anime', 'Cosplay', 'Goku', 'Youtuber', 'Influencer', 'Random', 'Trend', 'Fortnite',
      'Twitch', 'Rosalía', 'Bad Bunny', 'Duolingo', 'Easter Egg', 'Multiverso', 'Esports', 'Indie', 'Reel',
    ],
  },

  // ---- Cultura pop infantil: lo de hoy lo conocen los adolescentes; los clásicos duran toda la vida
  {
    label: 'Cultura pop infantil → adolescentes (salvo lo de preescolar)',
    from: 'kids',
    to: ['teens'],
    popAll: true,
    except: ['Peppa Pig', 'Patrulla Canina', 'Bluey', 'Elmo', 'Hello Kitty', 'Bakugan', 'Capi', 'Niño Elegido', 'Gamemode'],
  },
  {
    label: 'Franquicias infantiles clásicas → jóvenes',
    from: 'kids',
    to: ['young'],
    names: [
      'Mario', 'Luigi', 'Peach', 'Bowser', 'Yoshi', 'Toads', 'Donkey Kong', 'Mario Kart', 'Super Mario', 'Zelda', 'Link', 'Sonic', 'Tails', 'Eggman',
      'Pikachu', 'Pokémon', 'Charmander', 'Charizard', 'Bulbasaur', 'Ivysaur', 'Venusaur', 'Squirtle', 'Blastoise', 'Mewtwo', 'Meowth',
      'Jigglypuff', 'Snorlax', 'Gengar', 'Haunter', 'Gyarados', 'Lapras', 'Onix', 'Psyduck', 'Zubat', 'Pidgey', 'Eevee', 'Jolteon', 'Flareon',
      'Vaporeon', 'Raichu', 'Geodude', 'Oddish', 'Hitmonlee', 'Alakazam', 'Arbok', 'Totodile', 'Quilava', 'Torchic', 'Pokedex', 'Master Ball',
      'Ash Ketchum', 'Jessie', 'Digimon', 'Dragon Ball', 'Naruto', 'Doraemon', 'Nobita', 'Inuyasha', 'Yu-Gi-Oh!', 'Lego', 'Hot Wheels', 'Furby',
      'Beyblade', 'Bakugan', 'Bob Esponja', 'Shrek', 'Fiona', 'Toy Story', 'Buzz Lightyear', 'Rex', 'Zurg', 'Nemo', 'Dory', 'Jafar', 'Mulan',
      'Mickey', 'Mickey Mouse', 'Donald', 'Pato Donald', 'Daisy', 'Dumbo', 'Cenicienta', 'Pocahontas', 'Pinocho', 'Peter Pan', 'Ursula',
      'Ariel', 'Flounder', 'Rapunzel', 'Simba', 'Nala', 'Hércules', 'Stitch', 'Lilo', 'Jiminy Cricket', 'Elsa', 'Frozen', 'Olaf', 'Moana',
      'Harry Potter', 'Hogwarts', 'Voldemort', 'Ron Weasley', 'Quirrel', 'Quidditch', 'Batman', 'Spiderman', 'Iron Man', 'Hulk', 'Thor',
      'Capitán América', 'Hawkeye', 'Quicksilver', 'Venom', 'X-Men', 'Groot', 'Garfield', 'Tom', 'Asterix', 'Yoda', 'R2-D2', 'Optimus Prime',
      'Tortugas Ninja', 'Raph', 'Minions', 'Gru', 'Cars', 'Rayo McQueen', 'Lightning McQueen', 'Angry Birds', 'Jenga', 'Minecraft', 'Creeper',
      'Enderman', 'Steve', 'TNT', 'Redstone', 'Nether', 'Fortnite', 'Cuphead', 'Crash Bandicoot', 'Fox McCloud', 'Uncharted', 'Animal Crossing',
      'Messi', 'Pixar', 'Disney', 'Nintendo', 'Xbox', 'Joystick', "Luigi's Mansion", 'Jack Sparrow', 'Vector', 'Hello Kitty',
    ],
  },
  {
    label: 'Franquicias infantiles que perduran → adultos',
    from: 'kids',
    to: ['adults'],
    names: [
      'Mickey', 'Mickey Mouse', 'Donald', 'Pato Donald', 'Daisy', 'Dumbo', 'Cenicienta', 'Pinocho', 'Peter Pan', 'Disney', 'Lego', 'Mario',
      'Luigi', 'Nintendo', 'Spiderman', 'Batman', 'Hulk', 'Iron Man', 'Thor', 'X-Men', 'Capitán América', 'Harry Potter', 'Hogwarts',
      'Voldemort', 'Shrek', 'Toy Story', 'Pixar', 'Asterix', 'Garfield', 'Tom', 'Simba', 'Nala', 'Hércules', 'Ursula', 'Ariel', 'Rapunzel',
      'Pocahontas', 'Mulan', 'Jafar', 'Jiminy Cricket', 'Minions', 'Gru', 'Optimus Prime', 'Yoda', 'R2-D2', 'Pokémon', 'Pikachu', 'Sonic',
      'Messi', 'Angry Birds', 'Uno', 'Jenga', 'Nemo', 'Dory', 'Tortugas Ninja', 'Bob Esponja', 'Doraemon', 'Dragon Ball', 'Stitch', 'Elsa',
      'Frozen', 'Cars', 'Rayo McQueen', 'Hello Kitty', 'Minecraft', 'Fortnite', 'Venom', 'Zelda', 'Mario Kart', 'Super Mario',
      'Donkey Kong', 'Yoshi', 'Bowser', 'Peach',
    ],
  },

  // ---- Cultura pop de jóvenes
  {
    label: 'Cultura pop de jóvenes → adultos',
    from: 'young',
    to: ['adults'],
    names: [
      'Alucinar', 'Aladdin', 'Avatar', 'Aída', 'Alejandro Sanz', 'Aquí no hay quien viva', 'Avril Lavigne', 'Amy Winehouse', 'Angry Birds',
      'Backstreet Boys', 'Bisbal', 'Breaking Bad', 'Britney Spears', 'Botellón', 'Bajón', 'Batman', 'Bob Marley', 'Buenafuente', 'BlackBerry',
      'Cristiano Ronaldo', 'Cuéntame', 'Crepúsculo', 'Coldplay', 'Chuck Norris', 'Cuarto Milenio', 'Cutre', 'Chungo', 'Colega',
      'Chiquito de la Calzada', 'Daft Punk', 'David Guetta', 'Dani Martín', 'Dr. House', 'Dar el cante', 'Doraemon', 'Eminem',
      'El Canto del Loco', 'Estopa', 'Eurovisión', 'El Rey León', 'Eurodance', 'Erasmus', 'El Hormiguero', 'Emma Watson', 'Enrique Iglesias',
      'Friends', 'FIFA', 'Fito y Fitipaldis', 'Facebook', 'Futurama', 'Flipar', 'Friki', 'Finde', 'Fórmula 1', 'Gran Hermano', 'Game Boy',
      'GTA', 'Google', 'Gangnam Style', 'Gladiator', 'Guay', 'Guiri', 'Grunge', 'Gorillaz', 'Harry Potter', 'Hotmail', 'Hulk', 'Hércules',
      'Hakuna Matata', 'Hipster', 'Hospital Central', 'iPod', 'iPhone', 'Instagram', 'Internet Explorer', 'Iker Casillas', 'Iniesta',
      'Indiana Jones', 'Ice Age', 'Inception', 'Indie', 'Ikea', 'Jackass', 'Jennifer López', 'Jack Sparrow', 'Justin Bieber',
      'Justin Timberlake', 'Jarabe de Palo', 'Juego de Tronos', 'Jedi', 'Jurassic Park', 'Jeta', 'Jordan', 'La Oreja de Van Gogh',
      'Los Simpson', 'Lost', 'Linkin Park', 'Lady Gaga', 'La Casa de Papel', 'Los Serrano', 'Lego', 'Lana del Rey', 'LOL', 'Like', 'Matrix',
      'Messenger', 'MySpace', 'Mario', 'Mortadelo y Filemón', 'Mägo de Oz', 'Muse', 'Manolito Gafotas', 'MTV', 'Molar', 'Meme', 'Nirvana',
      'Netflix', 'Nokia 3310', 'Narcos', 'Nemo', 'Nesquik', 'Nutella', 'NBA', 'Cuñao', 'Ñoño', 'Compañeros', 'El Señor de los Anillos',
      'Señor Burns', 'Doña Florinda', 'Peña', 'Mañana nunca muere', 'Piña colada', 'Operación Triunfo', 'Oasis', 'Oliver y Benji',
      "Ocean's Eleven", 'Obélix', 'Okupa', 'OK', 'Oscar', 'Oreo', 'Ozzy Osbourne', 'Ouija', 'Pokémon', 'Pasapalabra', 'PlayStation',
      'Pulp Fiction', 'Pablo Alborán', 'Pereza', 'Pitbull', 'Pearl Jam', 'Pink Floyd', 'Padre de familia', 'Postureo', 'Pasada',
      'Quentin Tarantino', 'Queen', 'Quiksilver', 'Quién quiere ser millonario', 'Quinto elemento', 'Quake', 'Quiz', 'Quesadilla', 'Quedada',
      'Quinqui', 'Quasimodo', 'Rihanna', 'Rosalía', 'Radiohead', 'Red Hot Chili Peppers', 'Reguetón', 'Real Madrid', 'Resident Evil',
      'Reality', 'Rolling Stones', 'Rave', 'Rollo', 'Shakira', 'Shrek', 'Spotify', 'Sálvame', 'South Park', 'Stranger Things', 'Selfie',
      'Snapchat', 'SMS', 'Star Wars', 'Shin Chan', 'Titanic', 'Tamagotchi', 'Tetris', 'Tarzán', 'The Beatles', 'TikTok', 'Twitter', 'Tinder',
      'Torrente', 'Teletubbies', 'U2', 'Usher', 'Un paso adelante', 'Ugly Betty', 'Undertaker', 'Uptown Funk', 'Underground', 'Uber', 'UFC',
      'Up', 'Vengadores', 'Vengaboys', 'Vin Diesel', 'V de Vendetta', 'Vikings', 'Valentino Rossi', 'Vlog', 'Viral', 'Vicky el Vikingo',
      'Velociraptor', 'Xbox', 'Xavi', 'X-Men', 'Xena', 'Xabi Alonso', 'Expediente X', 'Dexter', 'Pixar', 'Sexo en Nueva York', 'Alexa',
      'Xiaomi', 'Yoda', 'YouTube', 'Yellow', 'Yeah!', 'Yogui', 'Zelda', 'Zidane', 'Zoolander', 'Zombi', 'Zapping', 'Zara', 'Zumba', 'Zasca',
      'Zoom', 'Zlatan',
    ],
  },
  {
    label: 'Cultura pop de jóvenes → adolescentes',
    from: 'young',
    to: ['teens'],
    names: [
      'Aladdin', 'Avatar', 'Angry Birds', 'Batman', 'Cristiano Ronaldo', 'Chuck Norris', 'Crush', 'Digimon', 'Doraemon', 'El Rey León',
      'Hakuna Matata', 'Ice Age', 'Nemo', 'Shrek', 'Star Wars', 'Jedi', 'Yoda', 'Harry Potter', 'Hulk', 'Hércules', 'Vengadores', 'X-Men',
      'Xbox', 'PlayStation', 'FIFA', 'Fortnite', 'GTA', 'Mario', 'Lego', 'Zelda', 'Pokémon', 'Yoshi', 'Naruto', 'Shin Chan', 'Real Madrid',
      'Instagram', 'YouTube', 'Netflix', 'Spotify', 'TikTok', 'Google', 'iPhone', 'Snapchat', 'Uber', 'Zoom', 'Alexa', 'Xiaomi', 'Zara',
      'Selfie', 'Meme', 'Viral', 'Vlog', 'Like', 'Quiz', 'Quedada', 'Stranger Things', 'Los Simpson',
      'Futurama', 'Friends', 'Rihanna', 'Shakira', 'Lady Gaga', 'Rosalía', 'Reguetón', 'Drake', 'Don Omar', 'Xavi',
      'Iniesta', 'Zidane', 'Pixar', 'Pasapalabra', 'Zombi', 'Eurovisión', 'Fórmula 1',
    ],
  },
]
