// Coco's pictures for "Show Coco your world" (made in Flow, see the prompts doc).
// AREA_ART: the big cards of step 1, by area. NICHE_ART: the cards of step 2, by the niche's slug (football,
// drama, islamic…; the slugs come from the server, see supabase/functions/qloo, "Niches").
// To add one: put the picture in assets/art/onboarding/niches/ and add a line here.
// A niche without a picture here shows the picture of its most popular thing, from Qloo.
export const AREA_ART: Record<string, number> = {
  sports: require('../assets/art/onboarding/niches/area-sports.png'),
  movies: require('../assets/art/onboarding/niches/area-movies.png'),
  shows: require('../assets/art/onboarding/niches/area-shows.png'),
  books: require('../assets/art/onboarding/niches/area-books.png'),
  history: require('../assets/art/onboarding/niches/area-history.png'),
};

export const NICHE_ART: Record<string, number> = {
  football: require('../assets/art/onboarding/niches/niche-football.png'),
  basketball: require('../assets/art/onboarding/niches/niche-basketball.png'),
  tennis: require('../assets/art/onboarding/niches/niche-tennis.png'),
  motorsport: require('../assets/art/onboarding/niches/niche-motorsport.png'),
  mma: require('../assets/art/onboarding/niches/niche-mma.png'),
  boxing: require('../assets/art/onboarding/niches/niche-boxing.png'),
  'american-football': require('../assets/art/onboarding/niches/niche-american-football.png'),
  baseball: require('../assets/art/onboarding/niches/niche-baseball.png'),
  cricket: require('../assets/art/onboarding/niches/niche-cricket.png'),
  volleyball: require('../assets/art/onboarding/niches/niche-volleyball.png'),
  cycling: require('../assets/art/onboarding/niches/niche-cycling.png'),
  'table-tennis': require('../assets/art/onboarding/niches/niche-table-tennis.png'),
  handball: require('../assets/art/onboarding/niches/niche-handball.png'),
  rugby: require('../assets/art/onboarding/niches/niche-rugby.png'),
  padel: require('../assets/art/onboarding/niches/niche-padel.png'),
  action: require('../assets/art/onboarding/niches/niche-action.png'),
  adventure: require('../assets/art/onboarding/niches/niche-adventure.png'),
  comedy: require('../assets/art/onboarding/niches/niche-comedy.png'),
  drama: require('../assets/art/onboarding/niches/niche-drama.png'),
  fantasy: require('../assets/art/onboarding/niches/niche-fantasy.png'),
  scifi: require('../assets/art/onboarding/niches/niche-scifi.png'),
  mystery: require('../assets/art/onboarding/niches/niche-mystery.png'),
  crime: require('../assets/art/onboarding/niches/niche-crime.png'),
  thriller: require('../assets/art/onboarding/niches/niche-thriller.png'),
  western: require('../assets/art/onboarding/niches/niche-western.png'),
  family: require('../assets/art/onboarding/niches/niche-family.png'),
  war: require('../assets/art/onboarding/niches/niche-war.png'),
  biography: require('../assets/art/onboarding/niches/niche-biography.png'),
  anime: require('../assets/art/onboarding/niches/niche-anime.png'),
  islamic: require('../assets/art/onboarding/niches/niche-islamic.png'),
  'world-history': require('../assets/art/onboarding/niches/niche-world-history.png'),
  'science-history': require('../assets/art/onboarding/niches/niche-science-history.png'),
  empires: require('../assets/art/onboarding/niches/niche-empires.png'),
};
// a few of Qloo's names for the same thing
NICHE_ART.animation = NICHE_ART.family;
NICHE_ART['political-history'] = NICHE_ART['history-politics'] = NICHE_ART['military-history'] = NICHE_ART.empires;
