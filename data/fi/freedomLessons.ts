/**
 * Finnish text overlay for `data/freedomLessons.ts`, keyed by the same lesson
 * ids. Only the text fields (`title`, `idea`, `notice`, `reflect`) are
 * forked — `kind`, `beliefIds`, `triggerIds`, `sourceKind` and
 * `principleRefs` stay structural and live only in the English file.
 *
 * Tone matches the English doctrine (docs/research/freedom-principles.md
 * section E): curious, never combative, second person, no exclamation
 * marks, no deprivation vocabulary. `reflect` always ends in a question
 * mark, matching the English.
 *
 * Machine-translated, pending native-speaker review — see
 * docs/i18n-finnish-review.md.
 */
export const FI_FREEDOM_LESSON_TEXT: Record<
  string,
  { title: string; idea: string; notice?: string; reflect?: string }
> = {
  'tight-shoes': {
    title: 'Liian pienet kengät',
    idea: 'Riisu kaksi numeroa liian pienet kengät, ja helpotus on valtava. Jaloillesi ei tapahtunut mitään hyvää — epämukavuus vain päättyi, ja palasit siihen, miltä kaikki muut tuntevat koko päivän. Se on koko savukkeen mekanismi. Se ei lisää nautintoa perustasosi päälle. Se palauttaa sinut hetkeksi siihen perustasoon, josta tupakoimaton ihminen ei ole koskaan poistunutkaan.',
    notice:
      'Kun savuke tänään kuulostaa hyvältä, tarkista, mikä se hyvä osa oikeastaan on: jokin saapumassa, vai jokin päättymässä.',
    reflect:
      'Milloin savuke viimeksi teki hyvästä hetkestä paremman, sen sijaan että se lopetti epämukavan hetken?',
  },
  'the-longest-gap-tell': {
    title: 'Parhaat seuraavat pisintä taukoa',
    idea: 'Järjestä savukkeet, joita ihmiset kutsuvat parhaikseen: aamun ensimmäinen, pitkän lennon jälkeinen, se venyneen kokouksen jälkeinen. Kaava ei ole nautinto, vaan sitä edeltävän tauon pituus. Mitä syvempi keinotekoinen notkahdus, sitä paremmalta paluu normaaliin tuntuu. Suosikkisi eivät koskaan olleet ne mukavimmat. Ne olivat ne nälkäisimmät.',
    notice: 'Kun jokin hetki tänään tuntuu kaipaavan savuketta, laske taaksepäin, milloin edellinen olisi ollut.',
    reflect: 'Mitkä ”parhaista” savukkeistasi seurasivat pisintä taukoa?',
  },
  'stress-goes-down-from-here': {
    title: 'Stressi laskee tästä eteenpäin',
    idea: 'Savukkeiden välillä vieroitusoire soi hiljaisena jännityksen humuna, ja jokainen savuke hiljentää sen humun, jonka se itse loi. Siihen asti kyse on uudelleentulkinnasta. Mitattu osa: ihmiset, jotka lopettavat tupakoinnin, mittaavat kuukausia myöhemmin matalampaa ahdistusta, masennusta ja stressiä kuin ne, jotka jatkavat — vaikutuksen suuruus on verrattavissa masennuslääkkeisiin (Taylor, BMJ 2014; Cochrane 2021). Vaatimaton mutta hyvin todennettu, ja se osoittaa vain yhteen suuntaan.',
    notice:
      'Huomaa tänään jännitys, jonka normaalisti kirjaisit stressiksi, saapuvan aikataulun mukaan eikä minkään tapahtuneen seurauksena.',
    reflect: 'Jos tupakointi lisäsi omaa jännitystään, kuinka suuri osa päivästäsi oli lainattu siltä?',
  },
  'the-focus-dip-is-real': {
    title: 'Keskittymisen notkahdus on todellinen, ja lyhyt',
    idea: 'Rehellinen versio: keskittyminen todella notkahtaa vieroituksen alkuvaiheessa. Se on dokumentoitu vaikutus, ei harhaa, ja sen kieltäminen loukkaisi omaa kokemustasi. Se, mikä ei ole totta, on siitä tehty johtopäätös. Tupakointi ei koskaan lainannut sinulle keskittymiskykyä — se vain poisti jatkuvasti sen notkahduksen, jonka se itse loi jatkuvasti. Notkahdus on tilapäinen, ja se lakkaa uusiutumasta heti kun kierre lakkaa.',
    notice: 'Kun keskittyminen tänään herpaantuu, nimeä se ohi kulkevaksi vieroitusoireeksi, älä kadonneeksi kyvyksi.',
    reflect: 'Kuinka monta kertaa tarkkaavaisuutesi on palautunut itsestään, ilman että mitään on poltettu?',
  },
  'the-cue-not-the-cigarette': {
    title: 'Aivosi oppivat vihjeen',
    idea: 'Kaksikymmentä vuotta askin päivävauhtia on suunnilleen 1,5 miljoonaa vedon tasoista toistoa. Näin raskas oppiminen ei jää kiinni itse aineeseen: dopamiinisignaali siirtyy mihin tahansa, joka luotettavasti ennakoi sitä — vedenkeittimeen, auton oveen, ensimmäiseen kulaukseen, kävelyyn samalle ovelle. Kun kahvi siis tuntuu kaipaavan savuketta, kyse on ajallaan laukeavasta ennusteesta, ei todellisesta tarpeesta.',
    notice:
      'Nappaa tänään kiinni se täsmällinen vihje, joka käynnistää sen — esine, ääni, ovi — ennen kuin halu ehtii sanoiksi.',
    reflect: 'Mikä vihje päivässäsi puhuu eniten?',
  },
  'every-pass-is-a-rep': {
    title: 'Jokainen ohi menevä on yksi harjoituskerta',
    idea: 'Joka kerta kun vihje ilmestyy eikä mitään polteta, niiden välinen yhteys heikkenee. Se on tavallista oppimista, joka toimii sinun hyväksesi, kiinnititpä siihen huomiota tai et. Kaksi rehellistä varausta: se on asteittaista, ja se on tilannesidonnaista. Ensimmäinen drinkki tuntemattomassa kaupungissa voi tuntua taas ensimmäiseltä viikolta. Se ei ole takapakkia — se on sama oppiminen kohtaamassa uuden huoneen.',
    notice: 'Laske tänään yksi vihje, jonka kohtasit polttamatta. Se laski mukaan, tuntuipa siltä miltään sillä hetkellä tai ei.',
    reflect: 'Minkä tilanteen olet jo uudelleenjohdottanut huomaamattasi?',
  },
  'two-words-that-end-it': {
    title: 'Kaksi sanaa, jotka lopettavat keskustelun',
    idea: '”En polta” ja ”yritän lopettaa” saavat hyvin erilaisia vastauksia, ja ero on mitattu. ”En polta” kuulostaa identiteetiltä: asia on selvä, ei muuta keskusteltavaa. ”En voi” kuulostaa säännöltä, jonka joku muu on sinulle asettanut, mikä kutsuu neuvottelemaan — ensin heiltä, sitten sinulta itseltäsi. Sama kieltäytyminen, eri rakenne. Pidä ensimmäinen valmiina ennen kuin tarjous ehtii tulla.',
    notice: "Sano sanat tänään kerran ääneen tai hiljaa itseksesi, ennen kuin olet paikassa, jossa tarvitsisit niitä.",
    reflect: 'Kenen tarjoukseen vastaat todennäköisimmin tällä viikolla?',
  },
  'thoughts-are-allowed': {
    title: 'Sinun ei tarvitse lakata ajattelemasta sitä',
    idea: 'Yritä olla ajattelematta valkoista karhua, niin et ajattele juuri muuta. Tukahduttaminen suurentaa ajatuksen — niin luotettavasti, että ilmiöllä on oma nimensä tutkimuskirjallisuudessa. Tavoite ei siis koskaan ollut mieli, jossa ei ole yhtään savuketta. Ajatuksia tulee vielä jonkin aikaa. Sillä on väliä, minne ne laskeutuvat: ”hyvä, en enää tee niin” eikä ”minulla ei ole lupaa”. Sama ajatus, vastakkainen merkitys.',
    notice: 'Anna tänään yhden tupakointiin liittyvän ajatuksen tulla, äläkä tee sille mitään. Katso, kuinka kauan se todella kestää.',
    reflect: 'Kun ajatus tupakoinnista ilmestyy, miltä se tällä hetkellä kuulostaa?',
  },
  'the-trap-not-the-person': {
    title: 'Ansa, ei luonnevika',
    idea: 'Carrin vertauskuva tälle on kannukasvi: helppo mennä sisään, rakennettu niin, että poistuminen on vaikeaa, eikä yksikään hyönteinen ole koskaan valinnut sitä. Kukaan ei viisitoistavuotiaana päättänyt kolmestakymmenestä vuodesta tätä. Rakenne teki työn — ensimmäiset olivat epämiellyttäviä, koukku asettui hiljaa, ja uloskäynti tehtiin näyttämään kalliilta. Sinut värvättiin. Se tarkoittaa myös, ettei sinussa ole mitään vikaa korjattavana ennen kuin voit lähteä.',
    notice:
      'Kun vanha tarina epäonnistuneista yrityksistä nousee tänään esiin, huomaa sen kuvaavan, miten ansa rakennettiin — ei sitä, kuka olet.',
    reflect: 'Mitä sanoisit ystävälle, joka on jäänyt kiinni johonkin, joka on suunniteltu nimenomaan hänen kiinni jäämiseensä?',
  },
  'catch-the-relaxing-one': {
    title: 'Nappaa se kiinni: tämä rentouttaisi minua',
    notice: 'Olet jännittynyt, ja savuke ilmestyy ilmeisenä vastauksena.',
    reflect: 'Oliko jännitys siellä ennen mielitekoa, vai saapuiko se sen mukana?',
    idea: 'Tapahtumaketju kulkee päinvastoin kuin miltä se tuntuu: jännitys on vieroitusoire, savuke poistaa jännityksen, jonka se itse asensi, ja kierre kirjataan rentoutumiseksi. Tupakoimaton ihminen samassa tuolissa, samana päivänä, samalla työtaakalla ei hiljaa kaipaa mitään — ja lopettaneet mittaavat kuukausia myöhemmin vähemmän ahdistusta ja stressiä, ei enempää. Se ero sinun ja hänen välillään on riippuvuus, ei päivä.',
  },
  'catch-the-coffee': {
    title: 'Nappaa se kiinni: kahvi tarvitsee yhden',
    notice: 'Ensimmäinen kulaus laskeutuu, ja jokin tuntuu kesken jäävältä.',
    reflect: 'Mitä kahvi teki puolestasi, ennen kuin tupakointi kiinnittyi siihen?',
    idea: 'Savuke ei rakentanut tätä rituaalia. Se vain muutti sinne ja otti kunnian. Lämmin kuppi, päivän ensimmäinen tauko, kymmenen minuuttia, jolloin kukaan ei halua sinulta mitään — kaikki tämä säilyy ennallaan. Älä siis siirrä rituaalia äläkä juo sitä muualla. Pidä se juuri sellaisena kuin se on, ja huomaa sen tapahtuessa, että se on jo täydellinen.',
  },
  'catch-the-drink': {
    title: 'Nappaa se kiinni: drinkit ovat nyt erilaisia',
    notice: 'Toinen drinkki, joku astuu ulos, ja tunnet jääväsi jälkeen.',
    reflect: 'Vaihtaisiko tuo henkilö rehellisesti paikkaa kanssasi, jos voisi tehdä sen kasvojaan menettämättä?',
    idea: 'Se hetken vetovoima on yleensä kateutta, joka on suunnattu väärään ihmiseen. Lähes jokainen tupakoitsija toivoo, ettei olisi koskaan aloittanut; he eivät nauti herkusta, he vain täyttävät annostaan, jotta ilta pysyisi tavallisena. Pidä paikkasi, pidä drinkkisi, ja anna illan jatkua sellaisena, jonka takia lähdit ulos.',
  },
  'catch-the-after-meal-one': {
    title: 'Nappaa se kiinni: aterian jälkeinen',
    notice: 'Lautanen on tyhjä, ja ateriasta tuntuu puuttuvan viimeinen vaihe.',
    reflect: 'Kuinka kauan edellisestä savukkeesta oli, kun tuo tunne saapui?',
    idea: 'Aterian jälkeinen savuke seuraa yleensä illan pisintä savutonta jaksoa, jolloin notkahdus on syvimmillään — siksi se tuntuu päivän parhaalta. Jää pöytään kaksi minuuttia vanhaa kaavaa pidemmäksi aikaa, ja täyttymyksen tunne ilmestyy silti. Se tuli ateriasta.',
  },
  'catch-the-nothing-to-do': {
    title: 'Nappaa se kiinni: ei mitään tekemistä',
    notice: 'Aukko avautuu — jono, odotushuone, kymmenen minuuttia kahden asian välissä — ja tupakointi tarjoutuu vastaukseksi siihen.',
    reflect: 'Mitä osaa siitä tauosta oikeasti halusit: pysähdystä, ilmaa, muualla olemista, vai savua?',
    idea: 'Ulkona seisominen pieni palava esine kädessä ei tarkemmin katsottuna ole kiinnostavaa. Tylsyys on riskialtis hetki eri syystä: se poistaa häiriötekijät, jotka peittivät hiljaisen taustasignaalin, jolloin signaali pääsee esiin. Ja itse tauko oli aina se hyvä osa. Pidä kierto — ne kymmenen minuuttia, ovi, takaisin tuleminen — ja jätä siitä pois vain savuke.',
  },
  'catch-the-earned-one': {
    title: 'Nappaa se kiinni: olen ansainnut tämän',
    notice: 'Jokin meni hyvin, tai jokin oli vaikeaa, ja savuke ilmestyy palkkiona.',
    reflect: 'Mikä palkinto tarkalleen on — ja haluaisitko sitä, jos et olisi jo koukussa?',
    idea: 'Palkinnon pitäisi lisätä jotain. Tämä lopettaa epämukavuuden, jonka edellinen savukkeesi järjesti, ja varaa samalla ajan seuraavalle kierrokselle. Huomaa, miten outo palkinto se on: teit hyvää työtä, joten tässä on lyhyt paluu normaaliin, plus lasku. Eikä täällä ole mitään menetystä korvattavana. Sinulta ei oteta mitään pois, joten mitään ei tarvitse maksaa takaisin.',
  },
  'catch-just-one': {
    title: 'Nappaa se kiinni: yhdellä ei olisi väliä',
    notice: 'Myöhäistä, lämmintä, tupakoitsijoiden seurassa — ja yksi savuke tuntuu pieneltä, itsenäiseltä päätökseltä.',
    reflect: 'Onko todellinen kysymys ”yksi savuke”, vai ”kaikki uudelleen, huomisesta lähtien”?',
    idea: '”Vain yksi” ei koskaan paljasta, mitä se oikeasti on: ääni sen puolesta, että palaat joka päivä, koko päiväksi, vuosien ajaksi. Lähes kukaan ei jää siihen yhteen — kytkennät ovat yhä lämpiminä, ja yksikin veto ennustaa vahvasti täyttä paluuta. Kysy oikea kysymys, niin vastaus helpottuu. Ja jos yksi jo tapahtui, se oli vaikea hetki, ei tuomio. Kirjaa se ja jatka eteenpäin.',
  },
  'catch-the-highlight-reel': {
    title: 'Nappaa se kiinni: kaipaan sitä',
    notice: 'Muisto ilmestyy lämpimänä ja hyvin editoituna: tietty parveke, tietty ilta, savu, joka näyttää hyvältä valossa.',
    reflect: 'Mitä tapahtui kahdenkymmenen minuutin aikana sen savukkeen jälkeen, ja kahdenkymmenen minuutin aikana ennen sitä?',
    idea: 'Muisti säilyttää kohokohdat ja hylkää hiljaa loput: kello seitsemän maun, yskän, sateessa seisomisen, sen tarkistamisen, riittääkö huomiseksi. Älä kiistä hyvää muistoa — se on todellinen. Toista vain koko nauha, molemmat päät siitä. Nostalgia toimii vain editoidulla versiolla.',
  },
  'catch-the-duller-life': {
    title: 'Nappaa se kiinni: elämästä tulee tylsempää',
    notice: 'Kuvittelet ensi vuoden — sama työ, samat ystävät, ei savukkeita — ja se näyttää hieman harmaalta.',
    reflect: 'Mitkä asioista, joista pidät, oikeasti tarvitsivat savukkeen, ja missä se vain seisoi vieressä?',
    idea: 'Sen harmaan kuvan maalaa se asia, jota olet jättämässä, ja sillä on oma intressinsä lopputulokseen. Ateriat, drinkit, seura, musiikki, pitkän päivän loppu: mikään niistä ei syntynyt tupakoinnista. Se vain keskeytti ne, säännöllisin väliajoin, vuosien ajan. Toisella puolella ei ole tätä elämää miinus jotain. Se on tätä elämää ilman pientä, säännöllisesti aikataulutettua kriisiä.',
  },
  'catch-the-not-in-you': {
    title: 'Nappaa se kiinni: minulla ei ole sitä minussa',
    notice: 'Vanha epäonnistunut yritys nousee esiin todisteena sinusta.',
    reflect: 'Yrititkö haluta sitä vähemmän, vai yrititkö haluta sitä täsmälleen yhtä paljon ja sanoa ei joka kerta?',
    idea: 'Hampaat yhteen puristaminen tarkoittaa, että haluat savuketta ikuisesti ja puhut itsesi siitä pois useita kertoja päivässä. Se on epävakaa järjestely, eikä sen pettäminen kerro mitään sitä yrittävästä ihmisestä. Vaihtoehto ei ole paremmin varustettu sinä, vaan pienempi halu: muuta se, mitä uskot savukkeen tekevän puolestasi, niin mitään väiteltävää ei enää jää. Juuri tuo odotusten muutos ennustaa lopettamista — ei ominaisuus, joka sinulle annettiin tai ei annettu.',
  },
};
