// Phase 22 §"Naming Types" / Phase 24 §"Name Generator Starter" /
// Phase 31 §31.4 — naming profile registry.
//
// Phase 22 set up the seam: a registry-backed naming-profile store and
// an empty starter set. Phase 24 §"Name Generator Starter" populated a
// minimal `goblin_common` profile so deterministic name generation could
// be exercised by tests against the `names` RNG stream. Phase 31 §31.4
// adds two more starter profiles (`human_town`, `dwarf_caravan`) so
// staff identity factories can produce visibly different display-name
// patterns. The starter list stays intentionally small — the goal is
// proof that the generator supports distinct profiles, not full naming
// coverage.

import { Registry } from '../../registries/Registry'
import type { NamingProfile } from './nameTypes'

export const namingProfileRegistry = new Registry<NamingProfile>()

export const STARTER_NAMING_PROFILES: NamingProfile[] = [
  {
    id: 'goblin_common',
    label: 'Goblin Common',
    tags: ['goblin', 'short', 'sharp'],
    given: ['Nib', 'Grib', 'Snit', 'Brakka', 'Nesk', 'Gribna', 'Mizz', 'Vro', 'Takka', 'Skib', 'Krit', 'Brik', 'Zod', 'Snag', 'Gruzz', 'Klek', 'Tort', 'Vask', 'Drekk', 'Mok', 'Nub', 'Skreel', 'Wug', 'Pikka', 'Greb', 'Yip', 'Skarn', 'Plix', 'Brog', 'Krunk', 'Yaska', 'Tilm', 'Nupp', 'Gritt', 'Skitch', 'Vrull', 'Krot', 'Klish', 'Bog', 'Snuk', 'Gluk', 'Drisk', 'Krat', 'Wob', 'Hek', 'Nirr', 'Twikka', 'Skez', 'Brimm', 'Klugg'],
    family: ['Cracket', 'Sootspoon', 'Tallowmug', 'Bentnail', 'Greasewick', 'Mugbit', 'Stewfoot', 'Lampblack', 'Soapsour', 'Pottinger', 'Crustpan', 'Slatchnose', 'Wickbiter', 'Drainpipe', 'Smokegut', 'Pisspan', 'Grublip', 'Tinsnap', 'Boilshank', 'Rotscale', 'Mudwhisker', 'Bonepick', 'Spitbrick', 'Cogbelly', 'Knotrope', 'Mossteeth', 'Rawhide', 'Glumstool', 'Stinkpot', 'Boltchew', 'Ratcatch', 'Threadbare', 'Ashpot', 'Cinderfoot', 'Lardbottle', 'Greaseclaw', 'Slopjaw', 'Scrapnail', 'Tarsleeve', 'Pinchpenny'],
    nicknames: ['the Quick', 'Mug-Biter', 'Stool-Kicker', 'Soupnose', 'Ashfingers', 'Two-Teeth', 'Knee-High', 'Crookback', 'Goat-Eyed', 'Half-Ear', 'Onion-Breath', 'Lampshade', 'Stew-Burner', 'the Smaller', 'the Squat', 'Splinter-Hand', 'Pickle-Foot', 'Wart-Knuckle', 'Cellar-Mouse', 'Bucket-Head', 'Lid-Licker', 'the Twitchy', 'Mop-Hair', 'Wheezer', 'the Damp'],
    patterns: [
      {
        id: 'given_family',
        weight: 8,
        template: '{given} {family}',
        partKinds: ['given', 'family'],
        tags: ['formal'],
      },
      {
        id: 'given_nickname',
        weight: 2,
        template: '{given} {nickname}',
        partKinds: ['given', 'nickname'],
        tags: ['informal'],
      },
    ],
  },
  {
    id: 'human_town',
    label: 'Town Human',
    tags: ['human', 'town'],
    given: ['Mara', 'Tomlin', 'Bessa', 'Harl', 'Edda', 'Corvin', 'Wilm', 'Sera', 'Aelric', 'Alys', 'Beren', 'Cassa', 'Daved', 'Elgar', 'Fenric', 'Gareth', 'Halla', 'Idris', 'Joran', 'Kett', 'Linna', 'Maris', 'Norra', 'Osric', 'Perrin', 'Quenta', 'Roric', 'Symon', 'Thessa', 'Ulric', 'Vellis', 'Wat', 'Yara', 'Annis', 'Brom', 'Cedric', 'Doll', 'Elsa', 'Folkard', 'Gisla', 'Hews', 'Iona', 'Jenna', 'Kerrin', 'Lorne', 'Merritt', 'Nessa', 'Orman', 'Petra', 'Roland'],
    family: ['Vetch', 'Cooper', 'Marl', 'Rusk', 'Briar', 'Tanner', 'Hollow', 'Fletcher', 'Smith', 'Mason', 'Baker', 'Reeve', 'Miller', 'Thatcher', 'Carter', 'Wheeler', 'Hedge', 'Brook', 'Fielder', 'Aldridge', 'Brindle', 'Holloway', 'Ashford', 'Marshwood', 'Linton', 'Penn', 'Stowe', 'Walden', 'Hookley', 'Wadham', 'Pelham', 'Tibbet', 'Heath', 'Glover', 'Sawyer', 'Sutton', 'Norwood', 'Greenwell', 'Birch', 'Pennyworth'],
    patterns: [
      {
        id: 'given_family',
        weight: 8,
        template: '{given} {family}',
        partKinds: ['given', 'family'],
        tags: ['formal'],
      },
      {
        id: 'given_only',
        weight: 2,
        template: '{given}',
        partKinds: ['given'],
        tags: ['casual'],
      },
    ],
  },
  {
    id: 'dwarf_caravan',
    label: 'Dwarven Caravan',
    tags: ['dwarf', 'caravan', 'trade'],
    given: ['Borren', 'Hilda', 'Korrim', 'Dagna', 'Varric', 'Beldi', 'Thora', 'Orik', 'Bardin', 'Durgan', 'Falki', 'Grim', 'Heldir', 'Ivara', 'Joren', 'Kovri', 'Lodin', 'Mardi', 'Norri', 'Olda', 'Pelka', 'Rurik', 'Sigda', 'Torvi', 'Urvi', 'Vestra', 'Wodri', 'Yorrun', 'Brennor', 'Dordel', 'Eira', 'Fenna', 'Grindi', 'Helga', 'Ingrid', 'Karli', 'Loran', 'Modra', 'Naren', 'Oddrun', 'Rolf', 'Sigvi', 'Tegg', 'Ulfri', 'Vondi', 'Wilda', 'Yorgi', 'Brokk', 'Drenna', 'Korbund'],
    family: ['Stonekeg', 'Copperbraid', 'Ironpike', 'Ashbarrel', 'Deepmalt', 'Hammerfist', 'Goldvein', 'Anvilshore', 'Tinforge', 'Bronzemane', 'Granitebeard', 'Maltstride', 'Caskhand', 'Stoutbarrel', 'Forgewatch', 'Steelbrew', 'Oakcask', 'Coppershield', 'Silvermug', 'Quenchgrip', 'Hearthstone', 'Hopcrown', 'Brewlock', 'Coalbraid', 'Ironkettle', 'Steambelly', 'Coppertine', 'Anvilkin', 'Granitepick', 'Marblehelm', 'Lagerhaft', 'Ashtankard', 'Tinkettle', 'Smelterborn', 'Slaghand', 'Embergrip', 'Cinderkin', 'Stonebrace', 'Pickbraid', 'Boltbrew'],
    titles: ['Auntie', 'Uncle', 'Master', 'Mistress', 'Elder', 'Hearthkeeper', 'Forgewarden', 'Caskmother', 'Caskfather', 'Gaffer'],
    patterns: [
      {
        id: 'given_family',
        weight: 9,
        template: '{given} {family}',
        partKinds: ['given', 'family'],
        tags: ['formal'],
      },
      {
        id: 'title_given_family',
        weight: 1,
        template: '{title} {given} {family}',
        partKinds: ['title', 'given', 'family'],
        tags: ['ceremonial'],
      },
    ],
  },
  // Audit fixes pass 1 §1.5 — four culture-aligned naming profiles so
  // the customer-group and supplier rosters can route their generated
  // identities through visibly distinct profiles rather than collapsing
  // everyone onto `goblin_common`.
  {
    id: 'miner_workcrew',
    label: 'Mining Workcrew',
    tags: ['miner', 'workcrew', 'short'],
    given: ['Hodd', 'Brunn', 'Kev', 'Marn', 'Tess', 'Yorra', 'Plym', 'Drev', 'Bill', 'Chad', 'Donn', 'Erm', 'Flin', 'Gam', 'Hux', 'Ib', 'Jad', 'Korr', 'Lem', 'Mig', 'Nor', 'Olm', 'Pim', 'Quill', 'Rod', 'Stark', 'Tully', 'Urn', 'Wess', 'Yens', 'Zenn', 'Anse', 'Bram', 'Carn', 'Dolf', 'Esk', 'Fern', 'Galt', 'Hett', 'Idd', 'Kell', 'Lor', 'Mim', 'Nash', 'Otto', 'Pid', 'Reb', 'Sten', 'Tor', 'Vins'],
    family: ['Pickbreaker', 'Ironback', 'Coalhand', 'Slatebreaker', 'Deeprun', 'Shaftborn', 'Cinderlung', 'Tarmaul', 'Lampcrack', 'Stonejaw', 'Dustchoke', 'Cavewalk', 'Pithammer', 'Slagwell', 'Quarrysmite', 'Tunnelfoot', 'Coalvein', 'Earthsplit', 'Rockfall', 'Picknose', 'Granitejaw', 'Sootlung', 'Oresplit', 'Diggerlow', 'Mudshank', 'Bedrock', 'Coalsmith', 'Carbidehand', 'Drosspike', 'Hardpan', 'Cobblegrit', 'Pitwalker', 'Slatefall', 'Drillshank', 'Vainpick', 'Crumbleknee', 'Soreback', 'Cinderhew', 'Furnacejaw', 'Shaftkin'],
    patterns: [
      {
        id: 'given_family',
        weight: 9,
        template: '{given} {family}',
        partKinds: ['given', 'family'],
        tags: ['formal'],
      },
      {
        id: 'given_only',
        weight: 1,
        template: '{given}',
        partKinds: ['given'],
        tags: ['casual'],
      },
    ],
  },
  {
    id: 'merchant_roadfolk',
    label: 'Merchant Roadfolk',
    tags: ['merchant', 'road', 'trade'],
    given: ['Alric', 'Renna', 'Veska', 'Tomis', 'Hessa', 'Brell', 'Mavin', 'Larissa', 'Adrian', 'Bertram', 'Cellis', 'Donna', 'Elias', 'Faolan', 'Geraint', 'Helvia', 'Isolde', 'Jorin', 'Korbin', 'Lirien', 'Maelis', 'Nessia', 'Othra', 'Persis', 'Quintus', 'Roselin', 'Sabin', 'Tessa', 'Urian', 'Vellora', 'Willem', 'Xaver', 'Yvora', 'Aldous', 'Berta', 'Cantor', 'Daria', 'Emmet', 'Faline', 'Gerth', 'Hellis', 'Iverra', 'Jorrah', 'Kessler', 'Liona', 'Marin', 'Norvin', 'Olwen', 'Pellam', 'Reni'],
    family: ['Caravan', 'Roads', 'Mileson', 'Wagonley', 'Sterling', 'Postmark', 'Tollgate', 'Highway', 'Markwell', 'Sealwax', 'Cargoright', 'Ledgerly', 'Bondwell', 'Tally', 'Crownmark', 'Goldmark', 'Silverstamp', 'Coppergate', 'Wayfarer', 'Crossroads', 'Hillsroad', 'Saltway', 'Drovers', 'Mileshire', 'Inkwell', 'Strongbox', 'Coachmark', 'Postbridge', 'Tollkeep', 'Strongcoin', 'Threepence', 'Halfpenny', 'Coffer', 'Bankhouse', 'Strongbond', 'Wheelbridge', 'Roadwarden', 'Coachsmith', 'Saltbridge', 'Caravell'],
    titles: ['Trader', 'Factor', 'Master', 'Mistress', 'Goodwife', 'Goodman', 'Caravanmaster', 'Roadmaster', 'Counsellor', 'Reckoner'],
    patterns: [
      {
        id: 'given_family',
        weight: 7,
        template: '{given} {family}',
        partKinds: ['given', 'family'],
        tags: ['formal'],
      },
      {
        id: 'title_given_family',
        weight: 3,
        template: '{title} {given} {family}',
        partKinds: ['title', 'given', 'family'],
        tags: ['professional'],
      },
    ],
  },
  {
    id: 'ogre_clans',
    label: 'Ogre Clans',
    tags: ['ogre', 'clan', 'loud'],
    given: ['Grollix', 'Marrok', 'Ulluk', 'Drazga', 'Bellor', 'Korragh', 'Grosk', 'Hrokk', 'Mogga', 'Drokk', 'Pulluk', 'Rugga', 'Skarrog', 'Throgg', 'Urruk', 'Varrok', 'Wokka', 'Yagra', 'Zorruk', 'Brogga', 'Gorruk', 'Erruk', 'Fhulk', 'Gurrok', 'Hagga', 'Krugga', 'Lurruk', 'Mokka', 'Nagrok', 'Olgga', 'Pruzga', 'Rakka', 'Sorruk', 'Tagga', 'Uggor', 'Vrakka', 'Wragga', 'Zugga', 'Glurrok', 'Khazza', 'Lothka', 'Mukkar', 'Norrak', 'Othak', 'Phorra', 'Qollak', 'Rakhar', 'Sokka', 'Targa', 'Borruk'],
    family: ['Clobberkin', 'Boneclan', 'Stoneblood', 'Crackjaw', 'Ironbrood', 'Skullsmash', 'Bonecrack', 'Brutebreak', 'Marrowclan', 'Tuskfist', 'Gutslam', 'Skullclan', 'Boulderkin', 'Cleavebrood', 'Mawclan', 'Spinesnap', 'Stonebreak', 'Bonesmash', 'Marrowfist', 'Ribcrack', 'Slamfoot', 'Tombhand', 'Bashbrood', 'Cragclan', 'Brokenfang', 'Grimbone', 'Skullhammer', 'Spinecrack', 'Tuskbrood', 'Stompfist', 'Earthsmash', 'Mawcrush', 'Sinewbreak', 'Throatcrush', 'Bashclan', 'Heavyfoot', 'Stonemaw', 'Crushpaw', 'Ruinbrood', 'Maulbrood'],
    patterns: [
      {
        id: 'given_family',
        weight: 7,
        template: '{given} {family}',
        partKinds: ['given', 'family'],
        tags: ['formal'],
      },
      {
        id: 'given_only',
        weight: 3,
        template: '{given}',
        partKinds: ['given'],
        tags: ['casual'],
      },
    ],
  },
  {
    id: 'adventuring_bands',
    label: 'Adventuring Bands',
    tags: ['adventurer', 'band', 'epithet'],
    given: ['Kael', 'Mira', 'Doran', 'Talvi', 'Sevren', 'Aldra', 'Arien', 'Berenor', 'Calra', 'Drevin', 'Elara', 'Faerwen', 'Galen', 'Halric', 'Iorel', 'Jaska', 'Kestral', 'Lyra', 'Maelyn', 'Naerin', 'Orlann', 'Pareth', 'Quenya', 'Ravven', 'Sarael', 'Tavish', 'Ulren', 'Valeran', 'Wynne', 'Yannic', 'Zarael', 'Aldren', 'Brenna', 'Caedrin', 'Dahlen', 'Eirenn', 'Faelan', 'Gerris', 'Halvor', 'Idren', 'Jaerin', 'Kessa', 'Larian', 'Maren', 'Noven', 'Orric', 'Perris', 'Quintor', 'Roselle', 'Stennor'],
    family: ['Vance', 'Roth', 'Briar', 'Cael', 'Ashbright', 'Caldwell', 'Dalemoor', 'Everwood', 'Frostmere', 'Greycloak', 'Hollander', 'Ironvale', 'Joryn', 'Karran', 'Leorin', 'Marston', 'Northgate', 'Osterling', 'Paelan', 'Quarn', 'Ranvar', 'Solaire', 'Thornwell', 'Uthrik', 'Varan', 'Westmark', 'Xandrith', 'Yorell', 'Zeradine', 'Ashthorn', 'Briarholt', 'Caethorn', 'Dunwald', 'Elwyn', 'Faerstone', 'Greyhall', 'Halrune', 'Ironcrown', 'Kithran', 'Lavren'],
    nicknames: ['the Bold', 'of the Wastes', 'Ironforge', 'Quickfoot', 'the Scarred', 'the Brave', 'the Steel', 'of the North', 'of the Vale', 'Stormwarden', 'Lionheart', 'Truesword', 'the Vigilant', 'Shieldborn', 'the Wandering', 'Stoneblade', 'of the Hollow', 'the Resolute', 'Stormcrest', 'the Bright', 'of the Dawnreach', 'the Far-Walker', 'Brightspear', 'the Stalwart', 'of the Iron Hills'],
    patterns: [
      {
        id: 'given_nickname',
        weight: 7,
        template: '{given} {nickname}',
        partKinds: ['given', 'nickname'],
        tags: ['epithet'],
      },
      {
        id: 'given_family',
        weight: 3,
        template: '{given} {family}',
        partKinds: ['given', 'family'],
        tags: ['formal'],
      },
    ],
  },
]

let initialized = false

export function ensureStarterNamingProfilesRegistered(): void {
  if (initialized) return
  for (const profile of STARTER_NAMING_PROFILES) {
    if (!namingProfileRegistry.has(profile.id)) {
      namingProfileRegistry.register(profile)
    }
  }
  initialized = true
}
