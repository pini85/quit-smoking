import type { InterventionKind } from '@/data/interventions';

/**
 * Finnish text overlay for `data/interventions.ts` — same ids, same prompt
 * array lengths (the 'delay' kind reuses `FI_TRUTH_CARDS` exactly as the
 * English `delay` reuses `TRUTH_CARDS`).
 *
 * Machine-translated, pending native-speaker review — see
 * docs/i18n-finnish-review.md.
 */
export const FI_TRUTH_CARDS: string[] = [
  'Tämä tunne on nikotiinin poistumista kehostasi, ei savukkeen kutsua. Se päättyy itsestään — yleensä muutamassa minuutissa.',
  'Savuke ei lopettaisi tätä mielitekoa. Se varaisi ajan seuraavalle.',
  'Et luovu mistään juuri nyt. Saat jotain takaisin.',
  'Tällä mieliteolla on muoto: se nousee, huipentuu ja hälvenee. Sinun tarvitsee vain katsoa sen tapahtuvan.',
  'Jokainen mieliteko, jonka kestät loppuun, heikentää fyysisesti sitä kytkentää, joka sen loi. Tämäkin lasketaan.',
  'Se ”helpotus”, jonka savuke antaa, on vain vieroitusoireen tauottamista. Sinä lopetat vieroitusoireen kokonaan sen sijaan.',
  'Sinun ei tarvitse saada tätä loppumaan nopeasti. Sinun tarvitsee vain olla polttamatta sen aikana. Se on jo häviämässä.',
  'Tupakoitsijoillakin on tämä täsmälleen sama tunne — jokaisen savukkeen välissä. Sinä koet sen nyt yhtenä viimeisistä kerroista.',
  'Mikään todellinen asia elämässäsi ei huonone, jos et polta seuraavan viiden minuutin aikana. Kaikki, mitä tämä sovellus mittaa, paranee.',
  'Olet jo tehnyt sen ainoan vaikean osan: seisot tässä etkä sytytä yhtään.',
];

export const FI_INTERVENTIONS: Record<
  InterventionKind,
  { title: string; tagline: string; prompts: string[] }
> = {
  breathing: {
    title: 'Hengitä sen läpi',
    tagline: 'Yksi minuutti. Sisään 4, ulos 6.',
    prompts: [
      'Hengitä sisään…',
      '…ja päästä irti',
      'Pidempi uloshengitys kuin sisäänhengitys — se on kytkin, joka rauhoittaa sinut',
    ],
  },
  'urge-surf': {
    title: 'Ratsasta aallolla',
    tagline: 'Mieliteot huipentuvat ja hälvenevät noin 3 minuutissa.',
    prompts: [
      'Älä taistele sitä vastaan. Tarkkaile sitä.',
      'Missä tunnet sen? Rinnassa? Leuassa? Käsissä?',
      'Se on jo huipussaan.',
      'Huomaa, kuinka se pienenee ilman apuasi.',
      'Et vastusta — tarkkailet.',
      'Se menee aina ohi. Se on menossa ohi juuri nyt.',
    ],
  },
  delay: {
    title: 'Odota se ohi',
    tagline: 'Viisi minuuttia. Siinä koko homma.',
    prompts: FI_TRUTH_CARDS,
  },
  water: {
    title: 'Kylmää vettä',
    tagline: 'Hae lasillinen. Juo se hitaasti.',
    prompts: [
      'Hae lasillinen kylmää vettä.',
      'Juo se hitaasti. Huomaa kylmyys.',
      'Palaa takaisin, kun olet valmis.',
    ],
  },
  'scene-change': {
    title: 'Vaihda ympäristöä',
    tagline: 'Mieliteot elävät paikoissa. Jätä tämä.',
    prompts: ['Nouse seisomaan.', 'Toinen huone — tai ulos.', 'Mieliteot ovat sidoksissa paikkoihin. Jätit juuri yhden taaksesi.'],
  },
  reasons: {
    title: 'Omat syysi',
    tagline: 'Omat sanasi, silloin kun sillä on väliä.',
    prompts: [],
  },
  proof: {
    title: 'Olet jo todistanut tämän',
    tagline: 'Oma lokisi kertoo, että voitat tämän.',
    prompts: [],
  },
};
