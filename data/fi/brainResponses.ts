import type { Belief } from '@/domain/types';

/**
 * Finnish text overlay for `data/brainResponses.ts` — same ids, same array
 * lengths per belief (the rotation `dayIndex % lines.length` in
 * `components/freedom/BrainFlow.tsx` must land on the same index in both
 * locales). `proofKind` is structural and stays in the English file.
 *
 * Tone matches the English doctrine: curious, never combative, second
 * person, no exclamation marks, no deprivation vocabulary.
 *
 * Machine-translated, pending native-speaker review — see
 * docs/i18n-finnish-review.md.
 */
export const FI_BRAIN_RESPONSES: Record<Belief, string[]> = {
  relaxation: [
    'Rauhaa. Se, mitä se tuottaa, on sen jännityksen päättyminen, jonka se itse loi tunti sitten — paluu tasapainoon, josta et olisi koskaan poistunut.',
    'Mikään ei ole vielä rentoutunut, eikä sen tarvitsekaan. Kireä olo on vieroitusoire, ja se hälvenee itsestään, ruokitpa sitä tai et.',
    'Tupakoimaton ihminen voi tässä täsmälleen samassa hetkessä ihan hyvin. Ero sinun ja hänen välillään on riippuvuus, ei tilanne.',
  ],
  'stress-relief': [
    'Että se tekisi tästä hallittavamman. Mutta tupakointi on lisännyt hiljaista jännityksen humua jokaisen savukkeen välillä — suurin osa stressistä, jonka se poistaa, on sen itsensä aiheuttamaa.',
    'Mikä tahansa tekeekin tästä vaikeaa, se on yhä täällä viiden minuutin kuluttua joka tapauksessa. Ainoa osa, johon tupakointi vaikuttaa, on se osa, jonka se itse loi.',
    'Ihmiset, jotka lopettavat, mittaavat kuukausia myöhemmin matalampaa stressiä ja ahdistusta, eivät korkeampaa. Vaatimaton mutta hyvin todennettu vaikutus — ja se osoittaa poispäin tästä hetkestä.',
  ],
  'coffee-ritual': [
    'Täydentävän kahvin. Kahvi on jo täydellinen: lämmin kuppi, päivän ensimmäinen tauko. Savuke on vain ilmestynyt paikalle ja ottanut kunnian.',
    'Tämä on laukaiseva vihje, ei todellinen tarve. Tuhannet toistot ovat opettaneet aivosi odottamaan yhtä juuri tässä, ja odotus hälvenee nopeammin kuin luulisi.',
    'Pidä kuppi, tuoli ja kymmenen minuuttia. Anna sen yhden osan, joka ei koskaan ollutkaan se nautinto, jäädä pois — ja katso, huomaatko eron.',
  ],
  'alcohol-pairing': [
    'Että drinkki ei olisi enää sama. Drinkki on täsmälleen sama. Se, mikä muuttuu, on että jäät istumaan paikoillesi sen ajaksi.',
    'Ulkona olevilla ei ole parempi ilta. He vain täyttävät annostaan, jotta ilta pysyisi tavallisena.',
    'Drinkki ei koskaan maistunut savulta. Se maistui drinkiltä, niiden kahden minuutin poissaolojen välissä pöydästä.',
  ],
  'meal-completion': [
    'Päivän parhaan. Se seuraa päivän pisintä taukoa savukkeiden välillä — juuri siksi se tuntuu siltä.',
    'Se kylläinen, valmis olo tuli ateriasta. Savuke saapuu myöhässä ja panee nimensä siihen.',
    'Kaksi minuuttia lisää pöydässä, ja sama tunne ilmestyy ilman sitäkin. Näin on aina käynyt.',
  ],
  concentration: [
    'Keskittymiskykyä. Keskittyminen todella heikkenee alkuvaiheessa — se osa on totta — ja se palautuu itsestään, mitä tupakointi ei koskaan antanut sinun huomata.',
    'Osa siitä on totta: nikotiini poistaa sen tarkkaavaisuuden notkahduksen, jonka nikotiinin väheneminen itse aiheutti, ja ottaa sitten kunnian paluusta. Se ei koskaan lainannut sinulle keskittymiskykyä, jota sinulla ei ollut.',
    'Edessäsi oleva työ on tehtävissä juuri tällä keskittymisen tasolla. Se ei vain tunnu siltä vielä muutamaan minuuttiin.',
  ],
  'boredom-relief': [
    'Jotain tekemistä. Ulkona seisominen pieni tuli kädessä ei tarkemmin katsottuna ole tekemistä.',
    'Tylsyys ei ole riskialtista siksi, että tupakointi olisi kiinnostavaa. Se on riskialtista siksi, ettei mikään muu peitä juuri nyt sitä hiljaista taustasignaalia.',
    'Kävele sama kävely ilman sitä, niin säilytät kaiken siinä hyvän: ilman, liikkeen, viiden minuutin tauon.',
  ],
  reward: [
    'Palkinnon. Palkinto on lyhyt paluu normaaliin, sekä ajanvaraus seuraavaan mielitekoon.',
    'Sait sen tehtyä. Se on jo tapahtunut, ja se pysyy tehtynä, sytytetäänpä mitään tai ei.',
    'Täällä ei olla kenellekään velkaa. Sinulta ei oteta mitään pois, joten mitään velkaa ei ole maksettavana.',
  ],
  'break-permission': [
    'Luvan pysähtyä. Pidä se tauko — tauko oli aina se hyvä osa, eikä se tarvitse savuketta ollakseen oikeutettu.',
    'Astu ulos, kymmenen minuuttia, ilman savuketta. Sama ilma, sama tauko, sama pako työpöydältä. Pidä kierto, jätä siitä pois vain se yksi asia.',
    'Savuke oli tekosyy, ei se tauko itse. Sinulla on lupa taukoon ihan omilla ehdoillaan.',
  ],
  'social-ease': [
    'Että se helpottaisi tätä. Katso, mihin ihmiset oikeasti reagoivat: ”En polta” lopettaa aiheen käsittelyn parissa sekunnissa.',
    'Kiusallisuus, jota se tarjoutuu korjaamaan, on suurimmaksi osaksi itse mieliteko. Se saapui halun mukana ja lähtee sen mukana.',
    'Olet ollut hyvää seuraa huoneissa ennenkin. Se ei koskaan ollut savukkeen ansiota.',
  ],
  confidence: [
    'Että olet erikoistapaus, koukussa muita pahemmin. Se on uskomusjärjestelmä, joka puhuu — ja sen asensi juuri se asia, joka väitettä esittää.',
    'Ihmiset, jotka polttivat sinua enemmän ja pidempään, ovat lopettaneet. Annos ei koskaan ollut se, mikä ratkaisi asian.',
    'Se, että jäät kiinni hyvin rakennettuun ansaan, kertoo paljon ansasta. Se ei kerro mitään sinusta.',
  ],
  identity: [
    'Että tämä on sitä, kuka olet. Olit joku jo ennen sitä, ja luonteenpiirteesi ovat ennallaan: sama huumorintaju, samat ystävät, sama maku kaikessa muussa.',
    'Lakkasit olemasta tupakoitsija sillä hetkellä, kun lopetit — ei jonkin koeajan jälkeen. Halu vain saavuttaa tosiasian kiinni hitaammin.',
    '”Tupakoitsija” oli jotain, mitä teit muutaman kerran tunnissa, ei persoonallisuus. Se näyttää rakenteelliselta vain sisältäpäin katsottuna.',
  ],
  deprivation: [
    'Että menetät jotain. Nimeä se: mikä täsmälleen katoaisi elämästäsi tänä iltana?',
    'Menetyksen tunne on uskoa siihen, että hyöty oli todellinen. Täältä ei vähennetä mitään.',
    'Et jää ilman mitään. Olit ilman vuosikausia, kahdenkymmenen minuutin erissä, ja kutsuit sitä helpotusta nautinnoksi.',
  ],
  'just-one': [
    'Että tämä on pieni ja itsenäinen asia. Todellinen kysymys ei ole yksi savuke — se on, oletko huomisesta lähtien taas tupakoitsija.',
    'Lähes kukaan ei jää siihen yhteen. Kytkennät ovat yhä lämpiminä, ja hyvin vähän riittää tuomaan koko järjestelmän takaisin.',
    'Mitä tahansa se tarjoaakin, se on poissa muutamassa minuutissa joka tapauksessa. Päätös, jota se pyytää, kestää vuosia.',
  ],
  'miss-it-forever': [
    'Että kaipaat tätä ikuisesti. Muisti säilyttää parvekkeen ja kauniin valon, ja pudottaa hiljaa pois kello seitsemän maun ja sateen.',
    'Kaipaaminen on ihan ok, ja se on ohimenevää. Ajatus voi tulla mieleen ilman, että mitään seuraa sen jälkeen.',
    'Toista koko tapahtumasarja, älä vain sitä editoitua versiota: halu, ulos meneminen, ne kaksi minuuttia, halu uudelleen.',
  ],
  'always-want': [
    'Että tämä on aina tällaista. Mieliteot eivät pysy tämänkokoisina — ne harvenevat ja pienenevät itsestään, tekemättä mitään erityistä.',
    'Jokainen vihje, jonka kohtaat ilman tupakointia, löysentää yhteyttä hieman. Tavallista oppimista, joka jatkuu huomasitpa sitä tai et.',
    'Yksi rehellinen varaus: aidosti uusi tilanne voi herättää vanhan yhteyden. Se ei ole kaiken alkaminen uudelleen. Se on vain yksi harjoituskerta lisää.',
  ],
  'life-worse': [
    'Tylsemmän elämän. Sen kuvan maalaa se asia, jota olet jättämässä, ja sillä on oma intressinsä lopputulokseen.',
    'Ateriat, drinkit, seura, musiikki — mikään niistä ei syntynyt tupakoinnista. Se vain keskeytti ne, säännöllisin väliajoin, vuosien ajan.',
    'Toinen puoli ei ole tätä elämää miinus jotain. Se on tätä elämää ilman pientä säännöllisesti aikataulutettua kriisiä.',
  ],
  'willpower-needed': [
    'Että tämä vaatii sellaista ihmistä, joka et ole. Lopettamista ennustaa se, mitä uskot savukkeen tekevän puolestasi, ja se on muutettavissa.',
    'Hampaat yhteen puristaminen tarkoittaa, että puhut itsesi pois jostain, mitä yhä haluat, useita kertoja päivässä. Yhden väittelyn häviäminen ei kerro sinusta mitään.',
    'Sinun ei tarvitse haluta yhtä ja sanoa ei ikuisesti. Tehtävä on lakata haluamasta sitä — se on eri tehtävä, jolla on eri loppu.',
  ],
};
