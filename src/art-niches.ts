// Coco's pictures for "Show Coco your world" (made in Flow, see the prompts doc).
// AREA_ART: the big cards of step 1, by area. NICHE_ART: the cards of step 2, by the niche's slug (football,
// drama, islamic…; the slugs come from the server, see supabase/functions/qloo, "Niches").
// To add one: put the picture in assets/art/onboarding/niches/ and add a line, e.g.
//   football: require('../assets/art/onboarding/niches/niche-football.png'),
// A niche without a picture here shows the picture of its most popular thing, from Qloo.
export const AREA_ART: Record<string, number> = {};

export const NICHE_ART: Record<string, number> = {};
