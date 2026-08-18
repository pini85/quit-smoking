export const sleep = {
  pageTitle: 'Kuorsausseuranta',
  disclaimer:
    'Tämä ei ole lääkinnällinen laite. Se ei havaitse uniapneaa eikä diagnosoi mitään — se vain vertaa öitäsi omaan lähtötasoosi.',
  webDevNote: 'Kehitystallennin: pidä tämä välilehti auki — sen sulkeminen tai vaihtaminen keskeyttää tallennuksen.',
  unavailable: {
    title: 'Kuorsausseuranta ei ole käytettävissä tässä',
    body: 'Kuorsausseuranta vaatii Unsmoke Android -sovelluksen — se ei ole käytettävissä tässä selaimessa tai laitteessa.',
  },
  preSleep: {
    title: 'Tänä yönä',
    tips: {
      placement:
        'Pidä puhelin samassa paikassa yöpöydällä joka yö — pysyvä sijainti tekee öistä keskenään vertailukelpoisia.',
      mic: 'Varmista, ettei mikrofonia peitä kotelo, tyyny tai peitto.',
      charger: 'Kytke laturi kiinni — seuranta kestää koko yön ja käyttää mikrofonia jatkuvasti.',
    },
    keepClips: {
      title: 'Säilytä äänikatkelmat',
      on: 'Kovaäänisimmistä kuorsausjaksoista tallennetaan lyhyitä katkelmia tälle laitteelle, jotta voit kuunnella ne myöhemmin.',
      off: 'Katkelmia ei tallenneta — vain lukemat.',
      privacyNote:
        'Katkelmat eivät koskaan poistu tältä laitteelta, ja koko yön tallenne poistetaan aina analyysin valmistuttua — säilytettiinpä katkelmia tai ei.',
      toggleOn: 'Päällä',
      toggleOff: 'Pois',
    },
    start: 'Aloita seuranta',
    starting: 'Aloitetaan…',
    permissionDenied: {
      title: 'Mikrofonin käyttöoikeus tarvitaan',
      body: 'Kuorsausseuranta tarvitsee mikrofonin käyttöoikeuden. Ota se käyttöön kohdassa Asetukset → Sovellukset → Unsmoke → Käyttöoikeudet ja yritä sitten uudelleen.',
    },
    deleteClipsSheet: {
      title: 'Poistetaanko olemassa olevat katkelmat?',
      body: 'Tämän kytkeminen pois päältä lopettaa uusien katkelmien tallentamisen. Voit myös poistaa aiempina öinä jo tallennetut katkelmat.',
      deleteExisting: 'Poista olemassa olevat katkelmat',
      keepExisting: 'Säilytä olemassa olevat katkelmat',
    },
  },
  active: {
    startedAt: 'Aloitettu {time}',
    elapsed: 'Kulunut aika',
    lockPhoneNote: 'Voit lukita puhelimen tai käyttää muita sovelluksia. Android jatkaa seurantaa taustalla.',
    stop: 'Lopeta seuranta',
    stopping: 'Lopetetaan…',
  },
  analyzing: {
    title: 'Analysoidaan viime yötä…',
    note: 'Tämä kestää yleensä vain hetken.',
    retry: 'Yritä analysointia uudelleen',
    retrying: 'Yritetään uudelleen…',
  },
  results: {
    title: 'Viime yö',
    duration: 'Seurattu',
    snoreDuration: 'Todennäköinen kuorsaus',
    eventsPerHour: 'Kuorsausjaksoja/h',
    avgIntensity: 'Keskimääräinen voimakkuus',
    burden: 'Kuorsausrasitus',
    interruptedNote: 'Tallennus päättyi kesken — tulokset saattavat olla puutteellisia.',
    failedNote: 'Viime yön tallennetta ei voitu analysoida — käyttökelpoista ääntä ei säilynyt.',
    intensityBands: {
      quiet: 'Hiljainen',
      moderate: 'Kohtalainen',
      loud: 'Voimakas',
      veryLoud: 'Erittäin voimakas',
    },
    vsBaselineDown: '↓ {percent} % lähtötasoosi verrattuna',
    vsBaselineUp: '↑ {percent} % lähtötasoosi verrattuna',
    vsBaselineFlat: '≈ ennallaan lähtötasoosi verrattuna',
  },
  trends: {
    title: 'Kuorsauksen kehitys',
    empty:
      'Kun olet seurannut {nights} yötä, näet täällä kuorsauksesi kehityssuunnan — ei arvailua, vain omaa dataasi.',
    metricToggle: {
      label: 'Kaavion mittari',
      burden: 'Rasitus',
      eventsPerHour: 'Jaksoja/h',
    },
    ariaBurden: 'Yöllinen kuorsausrasitus, kehitys ajan kuluessa',
    ariaEventsPerHour: 'Yölliset kuorsausjaksot tunnissa, kehitys ajan kuluessa',
    metricNames: {
      snoreDurationMs: 'Kuorsauksen kesto',
      eventsPerHour: 'Kuorsausjaksot tunnissa',
      avgIntensity: 'Keskimääräinen voimakkuus',
      snoreBurden: 'Kuorsausrasitus',
    },
    delta: {
      decreasedSincePreQuit: '{metric} on vähentynyt {percent} % tupakoinnin lopettamisen jälkeen.',
      increasedSincePreQuit: '{metric} on lisääntynyt {percent} % tupakoinnin lopettamisen jälkeen.',
      unchangedSincePreQuit:
        '{metric} on suunnilleen ennallaan verrattuna aikaan ennen tupakoinnin lopettamista.',
      decreasedSinceFirstNights: '{metric} on vähentynyt {percent} % ensimmäisistä öistä lähtien.',
      increasedSinceFirstNights: '{metric} on lisääntynyt {percent} % ensimmäisistä öistä lähtien.',
      unchangedSinceFirstNights: '{metric} on suunnilleen ennallaan ensimmäisiin öihin verrattuna.',
    },
  },
  clips: {
    title: 'Kuorsauskatkelmat',
    delete: 'Poista katkelma',
  },
  history: {
    title: 'Unihistoria',
    failed: 'Analyysi epäonnistui',
    interrupted: 'Keskeytyi',
    delete: 'Poista tämä yö',
    deleteAll: 'Poista kaikki kuorsausdata',
    deleteNightSheet: {
      title: 'Poistetaanko tämä yö?',
      body: 'Tämä poistaa tallenteen ja sen lukemat pysyvästi.',
      confirm: 'Poista',
      cancel: 'Peruuta',
    },
    deleteAllSheet: {
      title: 'Poistetaanko kaikki kuorsausdata?',
      body: 'Tämä poistaa jokaisen yön tallenteen, lukemat ja katkelmat pysyvästi. Tupakoinnin lopettamiseen liittyvä datasi ei muutu.',
      confirm: 'Poista kaikki',
      cancel: 'Peruuta',
    },
  },
  progressEntry: {
    title: 'Kuorsaus',
    invite: 'Aloita kuorsauksen seuranta öisin ja katso, miten se muuttuu pysyessäsi savuttomana.',
    cta: 'Avaa kuorsausseuranta',
    lastNightLine: 'Viime yö: rasitus {burden}',
  },
};
