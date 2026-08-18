/**
 * Machine-translated, pending native-speaker medical review — see
 * docs/i18n-finnish-review.md. Do not treat as clinically verified.
 * Ids/timing/sources/evidenceLevel are NOT duplicated here — see
 * data/healthMilestones.ts for the structural fields this overlays.
 *
 * Every figure, percentage, study name and citation is preserved
 * byte-identical to the English source; only the surrounding prose is
 * translated. Hedge words ("roughly", "may", "not well established") are
 * carried through as the equivalent Finnish hedge, never upgraded to a firm
 * claim.
 */
export const FI_HEALTH_MILESTONE_TEXT: Record<
  string,
  { title: string; description: string; phrase?: string; honestNote?: string }
> = {
  'heart-rate-normalises': {
    title: 'Sykkeesi alkaa laskea kohti normaalia 20 minuutin sisällä.',
    description:
      "Nikotiini on piristävä aine, joka saa sydämesi lyömään nopeammin tupakoinnin aikana. Kun viimeisen savukkeen nikotiini alkaa poistua elimistöstä, sykkeesi alkaa tasaantua. Useimpien ihmisten leposyke laskee mitattavasti ensimmäisen vuorokauden aikana.",
  },
  'blood-pressure-drops': {
    title: 'Verenpaine alkaa laskea jo ensimmäisen puolen tunnin aikana.',
    description:
      'Jokainen savuke aiheuttaa lyhyen verenpaineen piikin. Kun tämä toistuva ärsyke poistuu, keskimääräinen verenpaineesi laskee — ambulatoriset tutkimukset osoittavat systolisen paineen olevan noin 3,5 mmHg ja diastolisen noin 1,9 mmHg matalampi savuttomina jaksoina. Pieniä lukuja, mutta ne vaikuttavat 24 tuntia vuorokaudessa.',
  },
  'carbon-monoxide-halves': {
    title: 'Puolet hiilimonoksidista on jo poistunut verestäsi noin 8 tunnin kohdalla.',
    description:
      'Hiilimonoksidi sitoutuu hemoglobiiniin noin 250 kertaa vahvemmin kuin happi ja vie paikkoja punasoluiltasi. Karboksihemoglobiinin mitattu puoliintumisaika on noin 4–5 tuntia, joten pitoisuudet puolittuvat yhden työpäivän aikana.',
  },
  'carbon-monoxide-normal': {
    title: '12 tunnin kohdalla hiilimonoksiditasosi on käytännössä palautunut normaaliksi.',
    description:
      'Noin kolmen puoliintumisajan jälkeen karboksihemoglobiini palautuu lähelle normaalia. Yksi nopeimmista ja konkreettisimmista voitoista — veresi hapenkuljetuskyky palautuu alle vuorokaudessa.',
  },
  'blood-oxygen-restored': {
    title: 'Veresi pystyy taas kuljettamaan täyden happikuorman vuorokauden sisällä.',
    description:
      'Kun hiilimonoksidi poistuu, hemoglobiini vapautuu tekemään varsinaista tehtäväänsä; tupakoinnin akuutit sydän- ja verisuonivaikutukset ovat suurelta osin palautuvia noin 12 tunnin raittiuden jälkeen, mukaan lukien mitattava parannus maksimaalisessa hapenkulutuksessa.',
  },
  'resting-heart-rate-persistent-drop': {
    title: 'Leposykkeesi laskee noin 7–9 lyöntiä minuutissa — ja pysyy siellä.',
    description:
      'Vuorokausi lopettamisen jälkeen keskimääräinen leposyke laski noin 74:stä noin 65:een lyöntiin minuutissa; vuoden seurannassa lasku pysyi ennallaan. Kymmeniätuhansia sydämenlyöntejä vähemmän joka päivä.',
  },
  'nicotine-cleared': {
    title: 'Itse nikotiini on poistunut verenkierrostasi noin vuorokaudessa.',
    description:
      'Plasman puoliintumisaika on vain noin 2–2,5 tuntia. Se, mikä jää jäljelle, ei ole itse aine, vaan opittu tapa ja sen jättämät muutokset reseptoreissa.',
  },
  'heart-attack-risk-starts-falling': {
    title: 'Sydänkohtauksen riskisi alkaa pienentyä jo ensimmäisenä päivänä.',
    description:
      'Tupakointi tekee verestä tahmeampaa ja hyytymisalttiimpaa; 24 tunnin sisällä tämä akuutti kuormitus alkaa helpottaa.',
  },
  'nocturnal-erections-24h': {
    title: 'Yöllinen erektiokyky paranee mitattavasti 24 tunnin sisällä viimeisestä savukkeestasi.',
    description:
      'Yöllinen turpoaminen parani merkittävästi jo 24 tunnin raittiuden jälkeen — jopa miehillä, jotka käyttivät yhä nikotiinilaastaria, mikä viittaa siihen, että savu — ei nikotiini — aiheuttaa suuren osan verisuonivauriosta.',
  },
  'withdrawal-onset': {
    title: 'Vieroitusoireet alkavat muutamassa tunnissa — merkki siitä, että aine poistuu, ei siitä, että jokin olisi vialla.',
    description:
      'Ärtyneisyys, levottomuus, päänsärky ja mieliteot alkavat tyypillisesti 4–24 tuntia viimeisen savukkeen jälkeen. Ennustettavaa, farmakologista ja ajallisesti rajattua.',
  },
  'taste-and-smell-begin-returning': {
    title: 'Maku- ja hajuaisti alkavat palata noin 48 tunnin kohdalla.',
    description:
      'Hermopäätteet alkavat uudistua, eivätkä reseptorit ole enää tervan peitossa. Kahvi, hedelmät ja suolaiset ruoat ovat yleisimpiä varhaisia havaintoja.',
  },
  'withdrawal-peak-day-3': {
    title: 'Kolmas päivä on vaikein — ja siitä eteenpäin helpottaa.',
    description:
      'Vieroitusoireet huipentuvat luotettavasti noin 72 tunnin kohdalla ja lievittyvät sen jälkeen. Huippu on aikataulutettu tapahtuma, ei loputon alamäki.',
  },
  'bronchial-tubes-relax': {
    title: 'Hengittäminen tuntuu helpommalta noin 72 tunnin kohdalla, kun hengitystiesi rentoutuvat.',
    description:
      'Savun supistamat keuhkoputket alkavat avautua; hengitys helpottuu ja energiaa alkaa palata kolmantena päivänä — vieroitusoireiden huippu voi joskus peittää tämän.',
  },
  'caffeine-hits-harder': {
    title: 'Kahvisi vaikuttaa suunnilleen kaksi kertaa voimakkaammalta, kun lopetat.',
    description:
      'Savu aktivoi maksan entsyymiä CYP1A2; kofeiinin poistuma elimistöstä hidastuu noin 36 % neljän päivän kuluessa, joten samat kupit voivat kaksinkertaistaa veren kofeiinipitoisuuden. Ensimmäisen viikon hermostuneisuus ja unettomuus johtuvat usein kofeiinista, ei vieroituksesta — puolita annostasi.',
    honestNote:
      'Puolita tavanomainen kahvimääräsi ensimmäisen viikon ajaksi — muuten saatat luulla kofeiinin aiheuttamaa hermostuneisuutta vieroitusoireeksi.',
  },
  'cotinine-clears': {
    title: 'Viimeinenkin kemiallinen jälki tupakasta poistuu kehostasi noin viikossa.',
    description:
      'Kotiniini (puoliintumisaika 16–20 tuntia) laskee alle 3 ng/ml:n — käytännössä tupakoimattoman lukeman — muutamassa päivässä.',
  },
  'taste-buds-regenerate': {
    title: 'Makunystyräsi uusiutuvat kokonaan 10–14 päivän välein.',
    description:
      'Makureseptorisolut ovat kehon nopeimmin uusiutuvia soluja; kasvatat kirjaimellisesti uuden, tervattoman setin kahdessa viikossa.',
  },
  'cough-may-worsen-first': {
    title: 'Huomio: yskäsi saattaa pahentua ennen kuin se paranee — ja se on paranemista.',
    description:
      'Uudelleen käynnistyvät värekarvat työntävät ulos limaa, joka on ollut jumissa. Noin puolella tilanne paranee ensimmäisen kuukauden aikana; noin 90 %:lla yskä häviää kokonaan.',
    honestNote:
      'Yskä voi pahentua ennen kuin se paranee — se on värekarvojen tapa puhdistaa jumissa ollutta limaa, ei huono merkki.',
  },
  'platelets-endothelium-early': {
    title: 'Veresi muuttuu vähemmän tahmeaksi ensimmäisinä päivinä lopettamisen jälkeen.',
    description:
      'Verihiutaleiden reaktiivisuus, hyytyminen ja verisuonen sisäpinnan merkkiaineet muuttuvat mitattavasti pian lopettamisen jälkeen — suuri syy siihen, miksi sydänkohtausriski laskee näin nopeasti.',
    phrase: 'Paranee ensimmäisten päivien ja viikkojen aikana lopettamisen jälkeen; tarkkaa lukua ei ole raportoitu.',
  },
  'circulation-improves': {
    title: 'Verenkierto paranee 2–12 viikon aikana — kävely ja juokseminen helpottuvat.',
    description:
      'Verenkierto käsiin, jalkoihin, ihoon ja lihaksiin paranee; kylmät kädet ja jalat helpottavat usein.',
  },
  'lung-function-increases': {
    title: 'Keuhkojen toiminta paranee mitattavasti 2–12 viikon kuluessa.',
    description:
      'Keuhkoahtaumatautitutkimukset: noin 47 ml:n (noin 2 %:n) FEV1-arvon nousu lopettamista seuraavan vuoden aikana — todellinen nousu, ei vain hitaampi lasku. ("10 %" on suosittu yksinkertaistus.)',
  },
  'vo2max-improves': {
    title: 'Aerobinen kuntosi paranee mitattavasti neljänteen viikkoon mennessä ja jatkaa nousuaan.',
    description:
      'CEASEFIRE-tutkimus: VO2max nousi +2,4 ml/kg/min neljänteen viikkoon mennessä ja +2,7 kahdenteentoista viikkoon mennessä; entisten tupakoitsijoiden VO2max ei tilastollisesti eroa koskaan tupakoimattomien arvoista.',
  },
  'withdrawal-resolves': {
    title: 'Suurin osa vieroitusoireista on hävinnyt 2–4 viikon kuluessa.',
    description:
      'Viha, ahdistus, keskittymisvaikeudet, kärsimättömyys, unettomuus ja levottomuus huipentuvat ensimmäisellä viikolla ja kestävät tyypillisesti 2–4 viikkoa.',
  },
  'nicotine-receptors-normalise': {
    title: 'Aivosi kasvattivat ylimääräisiä nikotiinireseptoreita — ne palautuvat ennalleen noin 3 kuukaudessa.',
    description:
      'PET-kuvantaminen: tupakoitsijoilla on noin 25 % enemmän α4β2-reseptoreita, jotka ovat yhä koholla neljän viikon kohdalla mutta normalisoituvat 6–12 viikon kuluessa. Tämä on fyysinen selitys sille, miksi kolmas kuukausi tuntuu käännekohdalta.',
  },
  'mao-recovery': {
    title: 'Tupakansavu vaimentaa mielialaa säätelevää aivoentsyymiä — se palautuu viikkojen kuluessa.',
    description:
      'Savu — ei nikotiini — estää MAO-A/B-entsyymien toimintaa; entisten tupakoitsijoiden MAO-B-tasot eivät eroa tupakoimattomien tasoista.',
    phrase: 'Palautuu viikkojen tai kuukausien kuluessa; tarkkaa lukua ei ole raportoitu.',
  },
  'taste-recovery-by-region': {
    title: 'Makuaisti palautuu vaiheittain eri puolilla kieltäsi noin kahden kuukauden aikana.',
    description:
      'Kielen kärki ja reunat palautuvat 2 viikon kuluessa, takaosan alueet 9 viikon kohdalla ja kielen selän alueet 2 kuukauden tai pidemmän ajan jälkeen.',
  },
  'smell-improves-45-days': {
    title: 'Objektiiviset hajuaistitestit osoittavat merkittävää paranemista noin 6 viikon kohdalla.',
    description:
      'TDI-testauksessa havaittiin merkittävää paranemista 45 päivän kohdalla; hajuepiteeli uusiutuu 60–90 päivän välein.',
  },
  'wound-healing-surgery': {
    title: 'Tästä syystä kirurgit pyytävät sinua lopettamaan 4–8 viikkoa ennen leikkausta.',
    description:
      'Vähintään 4 viikon raittius: 33 % pienempi haavakomplikaatioiden riski; jokainen lisäviikko lisää hyötyä noin 19 %. Todellinen biologinen kynnysarvo.',
  },
  'postop-complications-overall': {
    title: 'Lopettaminen kuukausi ennen leikkausta vähentää komplikaatioiden kokonaisriskiä noin 40 %.',
    description:
      'Satunnaistetut kontrolloidut tutkimukset osoittavat noin 41 %:n suhteellisen riskin pienenemisen, joka kasvaa pidemmän raittiuden myötä.',
  },
  'skin-collagen-recovery': {
    title: 'Ihon verenkierto ja kollageenituotanto paranevat ensimmäisten kuukausien aikana.',
    description:
      'Tupakointi vaimentaa kollageenisynteesiä; pienet tutkimukset viittaavat paranemiseen 4–12 viikon kuluessa, mutta näyttö on niukkaa. "Uskottava ja yleisesti raportoitu", ei todistettu.',
    honestNote:
      'Näyttö tästä toipumisikkunasta on niukkaa — uskottavaa ja yleisesti raportoitua, mutta ei todistettua.',
  },
  'mucociliary-clearance-recovers': {
    title: 'Keuhkojesi itsepuhdistuva liukuhihna käynnistyy uudelleen kuukauden sisällä.',
    description:
      '63 %:lla havaittiin merkittävää parannusta limakalvon värekarvapuhdistumassa kuukauden kohdalla, 85 %:lla 12 kuukauden kohdalla.',
  },
  'sleep-disrupted-then-better': {
    title: 'Rehellinen versio: uni huononee ensin, mutta paranee sitten paremmaksi kuin se oli tupakoitsijana.',
    description:
      'Unettomuus on vieroitusoire (kestää 2–4 viikkoa). Sen jälkeen tupakoinnin aiheuttama syvän unen ja REM-unen vaimentuminen kääntyy, ja yölliset pienet vieroitusjaksot lakkaavat pirstomasta unta.',
    honestNote:
      'Uni usein huononee ensimmäisten 1–4 viikon ajan (vieroitusoire), ennen kuin se muuttuu paremmaksi kuin se oli tupakoitsijana.',
  },
  'snoring-airway-inflammation': {
    title: 'Kuorsaus saattaa helpottaa, kun ylähengitysteiden tulehdus rauhoittuu.',
    description:
      'Tupakointi pahentaa uniapneaa hengitysteiden tulehduksen kautta; näyttö lopettamisen vaikutuksesta on havainnoivaa — prosenttilukuja ei ole.',
    phrase: 'Saattaa helpottua viikkojen tai kuukausien kuluessa hengitysteiden tulehduksen rauhoittuessa; ei ole hyvin vakiintunut tieto.',
  },
  'crp-inflammation-falls': {
    title: 'Kehosi tulehdusarvot laskevat kohti tupakoimattoman tasoa noin vuodessa.',
    description:
      'CRP-arvo saavuttaa tupakoimattoman tason noin vuosi lopettamisen jälkeen — yksi mekanismi vuoden sydänmerkkipaalun takana.',
  },
  'white-cell-count-normalises': {
    title: 'Kroonisesti koholla ollut valkosolumääräsi laskee takaisin.',
    description:
      'Vahvistettu raittius johtaa nopeaan ja pysyvään valkosolujen ja neutrofiilien määrän laskuun; täydellisen normalisoitumisen arvioidaan kestävän 1–10 vuotta.',
  },
  'anxiety-depression-improve': {
    title: 'Lopettaminen vähentää ahdistusta ja masennusta — ei aiheuta niitä.',
    description:
      'BMJ:n meta-analyysi: ahdistus −0,37 SMD, masennus −0,25, stressi −0,27, positiivinen mieliala +0,40; vaikutukset vastaavat masennuslääkkeitä, myös psykiatrisilla potilasryhmillä. "Tupakointi lievittää stressiä" tarkoittaa käytännössä vieroitusoireen lievitystä.',
  },
  'withdrawal-anxiety-cycle': {
    title: '”Rentouttava savuke” lievitti vieroitusoiretta, jota sinulla ei olisi ollut ilman tupakointia.',
    description:
      'Nikotiinin noin 2 tunnin puoliintumisaika tarkoittaa, että tupakoitsijat siirtyvät lievään vieroitusoireeseen ja siitä pois koko päivän ajan; jokainen savuke poistaa epämukavuuden, jonka edellinen savuke loi.',
    phrase: 'Purkautuu päivien tai viikkojen kuluessa, kun nikotiinikierre lakkaa toistumasta; tarkkaa lukua ei ole raportoitu.',
  },
  'concentration-recovers': {
    title: 'Keskittymiskyky notkahtaa muutamaksi viikoksi, mutta paranee sen jälkeen enemmän kuin jos olisit jatkanut tupakointia.',
    description:
      'Vieroitusoireiden aiheuttama ajatuksen sumeus häviää 2–4 viikon aikaikkunassa; vähintään 18 kuukautta lopettaneiden kognitiivinen muutos vastaa koskaan tupakoimattomien tasoa.',
  },
  'erectile-function-improves': {
    title: 'Erektiokyky jatkaa paranemistaan ensimmäisten kuuden kuukauden aikana.',
    description:
      'Merkittävää paranemista 2–12 viikon aikana; yli puolet erektiohäiriöstä kärsivistä miehistä, jotka lopettivat tupakoinnin, raportoi paranemisesta 6 kuukauden kohdalla.',
  },
  'breath-and-teeth': {
    title: 'Huono hengitys paranee muutamassa päivässä — mutta olemassa olevat hammastahrat vaativat hammashygienistin.',
    description:
      'Tervajäämät, vähentynyt syljeneritys ja muuttunut suun bakteerikanta korjaantuvat nopeasti; pinttyneet tahrat eivät poistu itsestään — varaa aika hampaiden puhdistukseen.',
    phrase: 'Hengitys paranee muutamassa päivässä; olemassa olevat hammastahrat vaativat ammattilaisen tekemän puhdistuksen.',
    honestNote:
      'Raikas hengitys palautuu nopeasti, mutta olemassa olevat hammastahrat eivät poistu itsestään — niitä varten tarvitset yhä hampaiden puhdistuksen.',
  },
  'secondhand-smoke-home': {
    title: 'Kotisi ilma puhdistuu sinä päivänä, kun lopetat.',
    description:
      'Satunnaistettu kontrolloitu tutkimus: kotitalouksien PM2.5-pitoisuus laski 35,2 prosenttiyksikköä enemmän interventiokodeissa, ja lasten syljen kotiniinipitoisuus laski samalla. Tupakoivien kotien lapsilla on enemmän yskää, hengityksen vinkumista, korvatulehduksia, keuhkoputkentulehdusta ja keuhkokuumetta.',
  },
  'pets-benefit': {
    title: 'Kissasi sairastuu lymfoomaan noin kaksi kertaa todennäköisemmin, jos tupakoit kotona.',
    description:
      'Tupakoivissa kotitalouksissa asuvilla kissoilla on noin kaksinkertainen riski sairastua pahanlaatuiseen lymfoomaan (ne myös nuolevat jäämät turkistaan pois → suuontelon levyepiteelisyöpä). Pitkäkuonoisilla koirilla riski on nenäsyöpä, lyhytkuonoisilla keuhkosyöpä. Lemmikit eivät voi poistua huoneesta.',
  },
  'smell-of-you': {
    title: 'Et enää haise savulle — ja alat haistaa sen muissa.',
    description:
      'Kun hajuaisti palautuu, useimmat entiset tupakoitsijat hämmästyvät, miten voimakkaasti savu tuntuu muissa ihmisissä.',
    phrase: 'Palautuu muutamassa päivässä hajuaistin palautuessa; tarkkaa lukua ei ole raportoitu.',
  },
  'cough-and-breathlessness-decrease': {
    title: 'Yskä, nenän tukkoisuus, väsymys ja hengenahdistus vähenevät 1–9 kuukauden aikana.',
    description:
      'Värekarvat kasvavat takaisin, hengitysteiden tulehdus laantuu; klassinen ”fyysisesti eri ihminen” -merkkipaalu.',
  },
  'sperm-quality-3-months': {
    title: 'Siittiöiden laatu paranee merkittävästi 3 kuukauden kohdalla.',
    description:
      'Merkittävää nousua siemennesteen määrässä, pitoisuudessa ja siittiömäärässä 3 kuukauden kohdalla (yksi täysi siittiötuotannon kierto); liikkuvuudessa ja rakenteessa 6 kuukauden kohdalla.',
  },
  'female-fertility-ivf': {
    title: 'Lopettaminen vähintään vuosi ennen hedelmällisyyshoitoa nostaa onnistumisprosentit lähelle koskaan tupakoimattomien tasoa.',
    description:
      'Tupakoitsijoilla koeputkihedelmöityksen raskaustodennäköisyys on noin 30 % matalampi. Rehellisesti: menetetty munasarjareservi ei palaudu — hyöty koskee tulevaisuutta.',
    honestNote:
      'Menetetty munasarjareservi ei palaudu — tämä hyöty koskee tulevien hoitojen onnistumista, ei olemassa olevan vaurion korjaantumista.',
  },
  'copd-symptoms-improve': {
    title: 'Jos sinulla on keuhkoahtaumatauti, lopettaminen on tehokkain hoito, joka on saatavilla.',
    description:
      'Vuoden mittainen satunnaistettu kontrolloitu tutkimus: jatkuvasti raittiina pysyneillä oli merkittävästi paremmat oirepisteet; heikkeneminen hidastuu lähelle normaalia ikääntymisen tahtia.',
  },
  'fev1-decline-slows': {
    title: 'Lopettaminen muuttaa keuhkojesi ikääntymisvauhdin pysyvästi.',
    description:
      'Lung Health Study: FEV1-arvo parani 2 vuoden ajan ja heikkeni sen jälkeen 28 ml/vuosi (lopettaneilla) verrattuna 62 ml/vuosi (tupakoivilla).',
  },
  'gerd-improves-1-year': {
    title: 'Refluksitauti paranee merkittävästi vuoden kuluessa lopettamisesta.',
    description:
      '43,9 % onnistuneesti lopettaneista raportoi refluksitaudin paranemisesta, verrattuna 18,2 %:iin jatkuvasti tupakoivista; elämänlaatu parani vain lopettaneilla.',
  },
  'oral-microbiome-recovers': {
    title: 'Suusi bakteeriekosysteemi palautuu tupakoimattoman tasolle.',
    description:
      'Entisten tupakoitsijoiden suun mikrobiomi ei eroa koskaan tupakoimattomien mikrobiomista; 12 kuukauden kohdalla tautiin liittyvät Treponema- ja Dialister-bakteerit vähenevät.',
  },
  'gum-healing-response-restored': {
    title: 'Ikenesi alkavat reagoida hammashoitoon kuten tupakoimattoman ikenet.',
    description:
      'Entisten tupakoitsijoiden paraneminen ja mikrobivaste hampaiden kiinnityskudossairauden hoidon jälkeen vastaa tupakoimattomien tasoa.',
    phrase: 'Palautuu jatkuvan raittiuden myötä kuukausien kuluessa; tarkkaa lukua ei ole raportoitu.',
  },
  'mucus-properties-12-months': {
    title: 'Vuoden kohdalla itse limakin muuttuu — se poistuu helpommin.',
    description: 'Noin 26 %:n parannus poistumiskyvyssä ja kaksinkertainen määrä hengitysteiden makrofageja.',
  },
  'cravings-decline': {
    title: 'Mieliteoista tulee harvinaisia, lyhyitä ja hallittavia jatkuvien sijaan.',
    description:
      'Fyysinen vieroitusoire häviää 2–4 viikossa; vihjeiden laukaisemat mieliteot kestävät minuutteja ja harvenevat ajan myötä. Niiden odottaminen etukäteen estää yhden mielitekon tulkitsemisen retkahdukseksi.',
  },
  'chd-risk-halved-1-year': {
    title: 'Vuoden jälkeen sepelvaltimotaudin lisäriskisi on noin puolet tupakoitsijan riskistä.',
    description:
      'WHO:n, CDC:n, NHS:n ja ACS:n keskeinen merkkipaalu. Tarkka sanamuoto: lisäriski puolittuu, ei kokonaisriski.',
  },
  'heart-attack-risk-halved-1-year': {
    title: 'Sydänkohtausriski laskee noin 50 % vuoden kuluessa.',
    description:
      'Lähestyy tupakoimattoman tasoa noin 15 vuoden kuluessa; sydäninfarktin jälkeen lopettaneet vähentävät uusiutuneen infarktin, äkkikuoleman ja kuolleisuuden riskiä jopa 50 %.',
  },
  'stroke-risk-falls': {
    title: 'Aivohalvausriski laskee jyrkästi toiseen vuoteen mennessä ja lähestyy koskaan tupakoimattomien tasoa 5–15 vuoden kuluessa.',
    description:
      'Nurses\' Health Study: −46 % kahden vuoden kohdalla (noin 80 % kokonaishyödystä). Anna vaihteluväli, ei yksittäistä lukua.',
  },
  'fibrinogen-normalises': {
    title: 'Veren hyytymisproteiinit palautuvat normaaliksi noin 5 vuoden kohdalla.',
    description: 'Fibrinogeeni normalisoituu noin 5 vuodessa; CRP vuoden sisällä; valkosolut vievät pidempään.',
  },
  'mouth-throat-larynx-cancer': {
    title: 'Suun, nielun ja kurkunpään syöpäriski puolittuu 5–10 vuoden kuluessa.',
    description: 'Kudos, joka on suorassa kosketuksessa savuun, reagoi nopeimmin; riski jatkaa laskuaan.',
  },
  'lung-cancer-10-years': {
    title: '10 vuoden jälkeen keuhkosyöpäriski on noin puolet edelleen tupakoivan riskistä.',
    description:
      'Ei vastaa koskaan tupakoimattoman riskiä; jäljelle jäävä lisäriski säilyy vuosikymmeniä (seulontaa suositellaan yhä).',
  },
  'bladder-cancer-risk': {
    title: 'Virtsarakon syöpäriski laskee noin 25 % ensimmäisten 10 vuoden aikana.',
    description:
      'WHI-tutkimus (143 000 naista): −25 % vuosikymmenen kuluessa, yhä koskaan tupakoimattomia korkeampi vielä 30 vuoden jälkeen. ”Merkittävä, jatkuva pieneneminen”, ei ”paluu normaaliksi”.',
  },
  'kidney-oesophagus-pancreas-cancer': {
    title: 'Ruokatorven, munuaisten ja haiman syöpäriski alkaa pienentyä noin 10 vuoden kohdalla.',
    description: 'Hitaampaa kuin suussa ja nielussa, mutta todellista ja kertyvää.',
  },
  'cervical-cancer-risk': {
    title: 'Kohdunkaulan syövän lisäriski laskee noin puoleen 20 vuoden kohdalla — ja epänormaalit solut korjaantuvat paremmin jo paljon aikaisemmin.',
    description: 'Tupakoitsijoilla lievien solumuutosten itsestään korjaantuminen on harvinaisempaa (55,0 % vs. 68,8 %).',
  },
  'chd-risk-nonsmoker-15-years': {
    title: '15 vuoden kohdalla sepelvaltimotaudin riski on lähellä koskaan tupakoimattoman tasoa.',
    description: 'Sydän- ja verisuonijärjestelmän toipumiskaaren päätepiste (WHO/ACS).',
  },
  'tooth-loss-risk': {
    title: 'Hampaiden menettämisen riskisi laskee vuosi vuodelta ja vastaa koskaan tupakoimattoman riskiä noin 13 vuoden kohdalla.',
    description: 'Suhteellinen riski laski 2,0:sta vuoden raittiuden kohdalla 1,0:aan 15 vuoden kohdalla.',
  },
  'fracture-risk-falls': {
    title: 'Luunmurtumariski laskee noin 1 % jokaista tupakoimatonta vuotta kohden.',
    description:
      'Merkittävää pienenemistä havaitaan 5–10 vuoden kohdalla. Luustoon liittyvät hyödyt tulevat hitaasti — tämä ei ole ensimmäisen vuoden merkkipaalu.',
  },
  'hearing-loss-risk': {
    title: 'Tupakointi vaurioittaa kuuloa — ja riski alkaa pienentyä 5 vuoden kuluessa lopettamisesta.',
    description:
      'Suhteellinen riski 1,43 (alle 5 vuotta lopettamisesta) → 1,27 (5–9 vuotta) → 1,17 (10–14 vuotta) → lähelle lähtötasoa.',
  },
  'macular-degeneration-risk': {
    title: 'Lopettaminen on ainoa todistetusti toimiva tapa pienentää ikään liittyvän silmänpohjan rappeuman riskiä.',
    description:
      'Tupakoitsijoilla on jopa 3–4-kertainen riski sairastua silmänpohjan rappeumaan; entisillä tupakoitsijoilla riski on vain hieman koskaan tupakoimattomia korkeampi.',
    phrase: 'Aikataulua ei ole vakiinnutettu; lopettaminen pienentää riskiä joka tapauksessa, riippumatta siitä, milloin vaikutus ilmenee.',
  },
  'cataract-risk': {
    title: 'Kaihiriski laskee lopettamisen jälkeen, vaikka tarkkaa aikataulua ei ole kartoitettu.',
    description: 'Tupakoitsijoilla on 2–3-kertainen riski sairastua kaihiin; riski pienenee lopettamisesta kuluneen ajan myötä.',
    phrase: 'Laskee vuosien myötä lopettamisesta, mutta ilman tarkkaa merkkipaalua.',
  },
  'dementia-risk': {
    title: 'Lopettaminen keski-iässä voi palauttaa dementiariskin koskaan tupakoimattoman tasolle noin vuosikymmenessä.',
    description:
      'Vähintään 3 vuotta raittiina olleilla entisillä tupakoitsijoilla ei havaittu kohonnutta dementiariskiä; Lancet-komissio 2024 luokittelee tupakoinnin keski-iässä muutettavissa olevaksi riskitekijäksi.',
  },
  'brain-cortex-recovery': {
    title: 'Tupakointi ohentaa aivokuortasi — ja se kasvaa osittain takaisin jokaista tupakoimatonta vuotta kohden.',
    description:
      'Toipuminen on todellista, asteittaista ja mahdollisesti vajaata paljon tupakoineilla (noin 25 savutonta vuotta askin päivävauhdilla 30 vuoden ajan tupakoineille).',
  },
  'crohns-disease-normalises': {
    title: 'Crohnin taudin osalta lopettaminen normalisoi taudin aktiivisuuden noin 2 vuodessa.',
    description:
      'Entisten tupakoitsijoiden taudin aktiivisuus vastaa koskaan tupakoimattomien tasoa 2 vuoden jälkeen. (Haavainen paksusuolentulehdus käyttäytyy päinvastoin — älä yleistä.)',
  },
  'rheumatoid-arthritis-risk': {
    title: 'Pitkäaikainen lopettaminen pienentää riskiäsi sairastua nivelreuman vaikeampaan muotoon.',
    description:
      'Pienentää seropositiivisen nivelreuman riskiä; parantaa taudinhallintaa ja lääkevastetta; olemassa oleva vaurio ei korjaannu.',
    phrase: 'Vaatii pitkäaikaista, vuosien mittaista raittiutta; tarkkaa merkkipaalua ei ole raportoitu.',
  },
  'infection-and-pneumonia-risk': {
    title: 'Vakavien infektioiden ja keuhkokuumeen riskisi pienenee jokaista tupakoimatonta vuotta kohden.',
    description:
      'Annosvasteinen pieneneminen; rehellinen jäljelle jäävä lisäriski (riskisuhde noin 1,08 infektioille, noin 1,17 keuhkokuumeelle).',
  },
  'inflammatory-response-drops-fast': {
    title: 'Osa tupakoinnin immuunivaikutuksista korjaantuu viikoissa, osa kestää vuosia.',
    description:
      'Nature 2024: liioiteltu tulehdusvaste häviää nopeasti lopettamisen myötä; T-solujen jättämä jälki säilyy vuosia epigeneettisten mekanismien kautta. Vahvin peruste lopettaa mahdollisimman pian.',
    phrase: 'Nopeat luontaisen immuniteetin vaikutukset korjaantuvat viikoissa; hankitun immuniteetin jättämä jälki voi säilyä vuosia.',
  },
  'type-2-diabetes-honest': {
    title: 'Rehellinen kohta: diabetesriski nousee tilapäisesti lopettamisen jälkeen — painonnousun ajamana — ja laskee sitten.',
    description:
      'Tätä ei havaita lopettajilla, jotka eivät lihoa; kuolleisuus laskee joka tapauksessa jyrkästi. Viesti: ”hallitse painoasi lopettamisen aikana”, ei koskaan ”jatka tupakointia”.',
    honestNote:
      'Diabetesriski voi nousta tilapäisesti lopettamisen jälkeen painonnousun seurauksena — hallitse painoasi lopettamisen aikana, älä koskaan jatka tupakointia sen välttämiseksi.',
  },
  'cancer-survival-after-diagnosis': {
    title: 'Jopa syöpädiagnoosin jälkeen lopettaminen pidentää elinaikaa merkittävästi.',
    description:
      'Meta-analyysi (17 584 potilasta): −26 % kuolleisuudessa, kun lopettaa keuhkosyöpädiagnoosin yhteydessä; mediaanielinaika 659 vs. 348 päivää. Ei koskaan liian myöhäistä.',
  },
  'life-expectancy-by-quit-age': {
    title: 'Lopettaminen 35-vuotiaana tuo takaisin noin 8 elinvuotta; 65-vuotiaanakin yhä noin 1,7 vuotta.',
    description:
      '+8,0/5,6/3,4/1,7/0,7 vuotta lopetettaessa iässä 35/45/55/65/75; noin 10 % 65-vuotiaana lopettaneista saa vähintään 8 lisävuotta.',
    phrase: 'Hyöty kertyy jäljellä olevan elinaikasi kuluessa ja on sitä suurempi, mitä aikaisemmin lopetat; lopettamisesta kuluneisiin tunteihin perustuvaa lukua ei sovelleta.',
  },
  'quit-before-40': {
    title: 'Lopettaminen ennen 40. ikävuotta välttää noin 90 % siitä elinajasta, jonka muuten menettäisit tupakointiin.',
    description:
      'Jha, NEJM 2013 (216 000 aikuista): lopettaminen ennen 40. ikävuotta vähentää ylimääräistä kuolemanriskiä noin 90 %.',
    phrase: 'Koskee lopettamista ennen 40. ikävuotta — elämänvaiheeseen sidottu kynnys, ei tästä hetkestä alkava laskuri.',
  },
  'hair-and-scalp': {
    title: 'Hiusten terveys saattaa parantua — mutta näyttö tästä on aidosti heikkoa.',
    description:
      'Hiustenlähtö ja harmaantuminen ovat yleisempiä tupakoitsijoilla; ei ole hyvää etenevää näyttöä siitä, että lopettaminen kääntäisi tämän. ”Saattaa auttaa”, ei aikataulua.',
    phrase: 'Ei luotettavaa aikataulua; näyttö siitä, että lopettaminen kääntäisi hiusmuutokset, on heikkoa.',
    honestNote:
      'Hiustenlähtö ja harmaantuminen ovat yleisempiä tupakoitsijoilla, mutta ei ole hyvää etenevää näyttöä siitä, että lopettaminen kääntäisi tämän.',
  },
  'dry-eye': {
    title: 'Rehellinen kohta: tupakointi liittyy silmien kuivumiseen, mutta lopettamisen ei ole osoitettu korjaavan sitä.',
    description:
      'Tupakoitsijoilla noin kaksinkertainen todennäköisyys silmien kuivumiselle; Mendelin satunnaistamistutkimus ei löytänyt hyötyä lopettamisesta. Sisällytetään vain varauksella.',
    phrase: 'Ei luotettavaa aikataulua; lopettamisen ei ole osoitettu tosiasiallisesti korjaavan silmien kuivumista.',
    honestNote:
      'Kontrolloiduissa tutkimuksissa ei ole osoitettu, että lopettaminen todella korjaisi silmien kuivumisen — tämä on mukana vain tällä varauksella.',
  },
  'financial-and-autonomy': {
    title: 'Lakkaat järjestämästä päivääsi kemikaalin ehdoilla.',
    description:
      'Entiset tupakoitsijat kertovat tavallisten vapauksien palaamisesta: lennot, elokuvat, kokoukset ja illalliset ilman poistumisen suunnittelua. BMJ:n meta-analyysi: psykologinen elämänlaatu +0,22, positiivinen mieliala +0,40.',
  },
};
