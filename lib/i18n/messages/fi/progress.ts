export const progress = {
  pageTitle: 'Edistys',
  cravingDecline: {
    title: 'Mielitekojen väheneminen',
    empty:
      'Ensimmäisen kirjatun viikon jälkeen tämä kaavio näyttää mielitekojen harvenevan ja heikkenevän. Se on sovelluksen vakuuttavin kaavio — sen haluat nähdä.',
    perWeek: 'Mielitekoja viikossa',
    avgIntensity: 'Keskimääräinen alkuvoimakkuus viikoittain',
    ariaCounts: 'Viikoittain kirjatut mieliteot ajan kuluessa',
    ariaIntensity: 'Viikoittainen keskimääräinen alkuvoimakkuus ajan kuluessa',
  },
  passRate: {
    title: 'Läpimenoprosentti',
    empty:
      'Viisi kirjattua mielitekoa avaa läpimenoprosenttisi. Useimmat yllättyvät, kuinka korkea se on.',
    passedOf: '{passed}/{resolved} meni ohi ilman tupakkaa',
    improving: 'paranee edelliseen 14 päivään verrattuna',
    declining: 'heikkenee edelliseen 14 päivään verrattuna',
    flat: 'ennallaan edelliseen 14 päivään verrattuna',
  },
  beforeVsNow: {
    title: 'Ennen vs nyt',
    empty:
      'Kahden viikon kohdalla näet ensimmäisen viikon ja tämän viikon rinnakkain. Kehitystä, johon voit osoittaa.',
    weekOne: 'Ensimmäinen viikko',
    thisWeek: 'Tämä viikko',
  },
  triggers: {
    title: 'Laukaisijat',
    empty:
      'Merkitse muutama mieliteko sen mukaan, mikä ne laukaisi, niin kaavasi näkyvät tässä. Useimmat yllättyvät todellisesta ykköslaukaisijastaan.',
    ariaLabel: 'Mieliteot laukaisijoittain, osuus merkityistä ja läpimenoprosentti',
    subLine: '{pct}% merkityistä · {passPct} meni ohi',
  },
  timeOfDay: {
    title: 'Vuorokaudenaika',
    empty:
      'Kun olet kirjannut noin kymmenen mielitekoa, kartoitamme riskialttiit tuntisi — jolloin ilta yhdeksän mieliteko muuttuu joksikin, jonka näit tulevan.',
    ariaLabel: 'Mieliteot vuorokaudenajan mukaan, korostaen vaikeinta kolmen tunnin ikkunaasi',
    caption: 'Kello {start}:00–{end}:00 on myrskyikkunasi.',
  },
  history: {
    title: 'Mielitekohistoria',
    showAll: 'Näytä kaikki {count}',
    sheetTitle: 'Mielitekon tiedot',
    untagged: 'merkitsemättä',
    outcomes: {
      passed: 'Meni ohi',
      muchWeaker: 'Paljon heikompi',
      stillThere: 'Kestetty',
      smoked: 'Poltettu — kirjattu rehellisesti',
      logged: 'Kirjattu',
    },
    started: 'Alkoi',
    duration: 'Kesto',
    intensity: 'Voimakkuus',
    trigger: 'Laukaisija',
    interventionsUsed: 'Käytetyt keinot',
    none: 'Ei mitään',
    itPromised: 'Se lupasi',
    outcome: 'Lopputulos',
    notes: 'Muistiinpanot',
  },
};
