/**
 * Finnish text overlay for `domain/achievements/definitions.ts`, keyed by the
 * same achievement ids. Only `title`/`fact` are forked — `condition` and
 * `tier` are structural and stay in the English file.
 *
 * `fact` carries medical/physiological claims (withdrawal timelines, health
 * recovery figures) — machine-translated, pending native-speaker review, see
 * docs/i18n-finnish-review.md.
 */
export const FI_ACHIEVEMENT_TEXT: Record<string, { title: string; fact: string }> = {
  'first-day': {
    title: 'Yksi kokonainen päivä',
    fact: '24 tunnin kuluessa nikotiini on kokonaan poistunut verenkierrostasi.',
  },
  'three-days': {
    title: 'Huippu on ohitettu',
    fact:
      'Vieroitusoireet huipentuvat tyypillisesti kolmantena päivänä — fyysisesti tästä eteenpäin mennään vain helpommaksi.',
  },
  'one-week': {
    title: 'Viikko vapaana',
    fact: 'Viikon kohdalla jopa kotiniinin (nikotiinin hajoamistuotteen) viimeisetkin jäljet ovat poistuneet kehostasi.',
  },
  'two-weeks': {
    title: 'Kaksi viikkoa',
    fact: '2–12 viikon savuttomuuden aikana verenkierto ja keuhkojen toiminta paranevat mitattavasti.',
  },
  'one-month': {
    title: 'Yksi kuukausi',
    fact:
      'Kuukauden kohdalla keuhkojesi värekarvat ovat taas töissä — 63 %:lla lopettaneista keuhkojen puhdistautuminen on parantunut.',
  },
  'hundred-days': {
    title: '100 päivää',
    fact:
      'Noin 100 päivän kohdalla (suunnilleen 3 kuukautta) aivojesi kasvattamat ylimääräiset nikotiinireseptorit ovat palautuneet normaalitasolle.',
  },
  'six-months': {
    title: 'Puoli vuotta',
    fact: 'Puolen vuoden kohdalla yli puolet tupakoitsijan yskästä kärsineistä entisistä tupakoitsijoista ovat päässeet siitä eroon.',
  },
  'one-year': {
    title: 'Yksi vuosi — Vapaa',
    fact: 'Vuoden savuttomuuden jälkeen sepelvaltimotaudin lisäriskisi on noin puolet tupakoitsijan riskistä.',
  },
  'avoided-10': {
    title: 'Ensimmäiset 10 polttamatta',
    fact:
      '10 polttamatonta savuketta — noin 20 elinminuuttia savuketta kohden, eli karkeasti 3 tuntia elinajanodotetta takaisin.',
  },
  'avoided-100': {
    title: '100 polttamatta',
    fact: '100 polttamatonta savuketta — karkeasti 33 tuntia elinajanodotetta takaisin.',
  },
  'avoided-500': {
    title: '500 polttamatta',
    fact: '500 polttamatonta savuketta — karkeasti 7 päivää elinajanodotetta takaisin.',
  },
  'avoided-1000': {
    title: '1 000 polttamatta',
    fact: '1 000 polttamatonta savuketta — karkeasti 2 viikkoa elinajanodotetta takaisin.',
  },
  'avoided-5000': {
    title: '5 000 polttamatta',
    fact: '5 000 polttamatonta savuketta — karkeasti 69 päivää elinajanodotetta takaisin.',
  },
  'saved-10': {
    title: 'Ensimmäiset 10 säästetty',
    fact: '10 jäi taskuusi savuna haihtumisen sijaan.',
  },
  'saved-50': {
    title: '50 säästetty',
    fact: '50 säästetty jättämällä savukkeet ostamatta.',
  },
  'saved-100': {
    title: '100 säilytetty',
    fact: '100 säilytetty — rahaa, joka ennen katosi aski kerrallaan.',
  },
  'saved-250': {
    title: '250 säilytetty',
    fact: '250 säilytetty ja lisää kertyy — kaikki rahaa, jota ei ole käytetty savukkeisiin.',
  },
  'saved-500': {
    title: '500 säilytetty',
    fact: '500 säilytetty — rahaa, joka olisi muuten mennyt kokonaan savukkeisiin.',
  },
  'saved-1000': {
    title: '1 000 säilytetty',
    fact: '1 000 säilytetty, eikä yhtäkään siitä ole kulunut savukkeisiin.',
  },
  'craving-1': {
    title: 'Ensimmäinen mieliteko, voitettu',
    fact: 'Kestit ensimmäisen mielitekosi ilman tupakointia — useimmat mieliteot huipentuvat ja hälvenevät 3–5 minuutissa.',
  },
  'craving-10': {
    title: '10 mielitekoa voitettu',
    fact: '10 mielitekoa voitettu — jokainen meni ohi muutamassa minuutissa, poltitpa tai et.',
  },
  'craving-25': {
    title: '25 voitettu',
    fact: '25 mielitekoa voitettu ilman tupakointia.',
  },
  'craving-50': {
    title: '50 voitettu',
    fact: '50 mielitekoa voitettu ilman tupakointia.',
  },
  'craving-100': {
    title: '100 voitettu',
    fact: '100 mielitekoa voitettu ilman tupakointia — 100 erillistä hetkeä, jolloin valitsit olla polttamatta.',
  },
  'coffee-10': {
    title: 'Kahvi, voitettu',
    fact: '10 kahvin laukaisemaa mielitekoa voitettu — yksi yleisimmin raportoiduista tupakoinnin vihjeistä murtuu.',
  },
  'stress-10': {
    title: 'Stressi, kestetty',
    fact: "10 stressin laukaisemaa mielitekoa voitettu — todiste siitä, ettei stressin tarvitse tarkoittaa savuketta.",
  },
  'after-food-10': {
    title: 'Vapaus aterian jälkeen',
    fact: '10 aterian jälkeistä mielitekoa voitettu — aterian jälkeinen savuke ei ole enää automaattinen.',
  },
  'quiet-24h': {
    title: 'Rauhallinen päivä',
    fact: 'Täydet 24 tuntia kului ilman yhtäkään kirjattua mielitekoa.',
  },
  'quiet-week': {
    title: 'Rauhallinen viikko',
    fact: 'Täydet 7 päivää kului ilman yhtäkään kirjattua mielitekoa.',
  },
  'smoke-free-weekend': {
    title: 'Ensimmäinen savuton viikonloppu',
    fact: 'Kokonainen viikonloppu — perjantai-illasta maanantaiaamuun — kului ilman savuketta.',
  },
};
