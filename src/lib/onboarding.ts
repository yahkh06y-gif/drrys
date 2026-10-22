// Onboarding shared bits.

/** Every onboarding screen that shows the progress bar, in order — the bar fills one step per screen. */
const STEPS = ['study', 'world', 'explore', 'first', 'plant', 'plan'] as const;
export type OnboardingStep = (typeof STEPS)[number];
export const progressOf = (step: OnboardingStep) => (STEPS.indexOf(step) + 1) / STEPS.length;

export type Opt = { label: string; sub?: string };

export const FIELDS = ['IT', 'Science', 'Business', 'Medicine', 'Art', 'Engineering', 'Law', 'Other'];

export const SUBFIELDS: Record<string, Opt[]> = {
  IT: [
    { label: 'CS', sub: 'Computer Science' },
    { label: 'AI', sub: 'Artificial Intelligence' },
    { label: 'SE', sub: 'Software Engineering' },
    { label: 'CYS', sub: 'Cyber Security' },
  ],
  Science: [{ label: 'Biology' }, { label: 'Chemistry' }, { label: 'Physics' }, { label: 'Math' }],
  Business: [{ label: 'Finance' }, { label: 'Marketing' }, { label: 'Accounting' }, { label: 'Management' }],
  Medicine: [{ label: 'MD' }, { label: 'Nursing' }, { label: 'Pharmacy' }, { label: 'Dentistry' }],
  Art: [{ label: 'Design' }, { label: 'Music' }, { label: 'Film' }, { label: 'Fine Arts' }],
  Engineering: [{ label: 'Civil' }, { label: 'Mechanical' }, { label: 'Electrical' }, { label: 'Chemical' }],
  Law: [{ label: 'Civil Law' }, { label: 'Criminal' }, { label: 'Business' }, { label: 'International' }],
  Other: [{ label: 'School' }, { label: 'Languages' }, { label: 'Exams' }, { label: 'Other' }],
};

/** The full name of a speciality, for Coco's lines ("Computer Science", not "CS"). */
export const subfieldName = (field?: string, sub?: string) =>
  SUBFIELDS[field ?? 'Other']?.find((o) => o.label === sub)?.sub ?? sub ?? field ?? 'your field';

/** Coco's first explanation: one famously hard idea per speciality.
 *  `usual`: the plain textbook way (the back of the card). `simple`: an analogy with no hobby in it,
 *  used when the AI can't be reached. */
export type Concept = { name: string; usual: string; simple: string };

const C = (name: string, usual: string, simple: string): Concept => ({ name, usual, simple });

const CONCEPTS: Record<string, Concept> = {
  'IT:CS': C('Recursion', 'Recursion is when a function solves a problem by calling itself on a smaller version of the same problem, until it reaches a base case that it can answer directly.', 'Picture a set of nesting dolls. To reach the smallest one, you open a doll and do the same thing again with the doll inside. You stop when a doll doesn’t open: that’s the base case.'),
  'IT:AI': C('Neural networks', 'A neural network is a model made of layers of connected units. Each connection has a weight; training adjusts the weights so the network’s outputs get closer to the correct answers.', 'Think of a team of judges passing notes. Each judge trusts some teammates more than others. After every wrong answer, they adjust whom they trust, and slowly the team gets it right.'),
  'IT:SE': C('Version control', 'Version control records every change to a project’s files over time, so developers can work on separate branches, compare versions and merge their work back together.', 'It’s like saving your game before every boss fight. You can try something risky on a copy, and if it goes wrong, you go back to the last save.'),
  'IT:CYS': C('Public-key encryption', 'Public-key encryption uses a pair of keys: a public key that anyone can use to encrypt a message, and a private key that only the owner has, which is needed to decrypt it.', 'Imagine handing out open padlocks to everyone. Anyone can snap one shut on a box for you, but only you have the key that opens it.'),
  'Science:Biology': C('Natural selection', 'Natural selection is the process in which individuals with traits better suited to their environment tend to survive and reproduce more, so those inherited traits become more common over generations.', 'Think of a game where only players with the right gear make it to the next round. Over many rounds, almost everyone left has that gear.'),
  'Science:Chemistry': C('Chemical equilibrium', 'Chemical equilibrium is the state of a reversible reaction where the forward and reverse reactions run at the same rate, so the amounts of reactants and products stay constant.', 'Picture two shops swapping customers at the same speed. People keep moving both ways, but the number in each shop stays the same.'),
  'Science:Physics': C('Inertia', 'Inertia (Newton’s first law) means an object stays at rest, or keeps moving in a straight line at constant speed, unless a net force acts on it.', 'A ball rolling on ice keeps going until something stops it. Things keep doing what they’re doing until a push or pull changes it.'),
  'Science:Math': C('Limits', 'A limit is the value a function gets closer and closer to as its input approaches a certain point, even if the function never actually reaches that value there.', 'Walk halfway to a wall, then half of what’s left, again and again. You never touch it, but you get as close as you like: the wall is the limit.'),
  'Business:Finance': C('Compound interest', 'Compound interest is interest calculated on the original amount and also on the interest already added, so the total grows faster and faster over time.', 'It’s a snowball rolling downhill: it picks up snow, and the snow it picked up helps it pick up even more.'),
  'Business:Marketing': C('Market segmentation', 'Market segmentation divides a broad market into smaller groups of customers with similar needs or traits, so a company can target each group with the right product and message.', 'A good DJ reads the room: one playlist for the dance floor, another for the people chatting at the back.'),
  'Business:Accounting': C('Double-entry bookkeeping', 'In double-entry bookkeeping, every transaction is recorded in at least two accounts, as a debit in one and a credit in another, so total debits always equal total credits.', 'Every move has two sides, like a trade between two players: what one gives, the other receives, so the books always balance.'),
  'Business:Management': C('Opportunity cost', 'Opportunity cost is the value of the best alternative you give up when you make a choice.', 'If you spend your evening gaming, the cost isn’t only the time: it’s the best other thing you could have done with that evening.'),
  'Medicine:MD': C('The immune system', 'The immune system defends the body against pathogens. Innate immunity responds fast and generally; adaptive immunity learns to recognise specific invaders and keeps memory cells for faster responses next time.', 'It’s a castle with guards at the gate who attack anything strange, plus a special team that studies each enemy and remembers its face for next time.'),
  'Medicine:Nursing': C('Homeostasis', 'Homeostasis is the body’s ability to keep internal conditions, like temperature and blood glucose, stable through feedback loops that sense a change and trigger a response that reverses it.', 'Like a thermostat: when the room gets too hot it switches the cooling on, and when it’s cool again it switches it off.'),
  'Medicine:Pharmacy': C('Drug half-life', 'A drug’s half-life is the time it takes for its concentration in the blood to fall by half. After about four to five half-lives, most of the drug has been eliminated.', 'Like a phone battery that loses half its charge every few hours: half, then a quarter, then an eighth, until almost nothing is left.'),
  'Medicine:Dentistry': C('Tooth decay', 'Tooth decay happens when bacteria in dental plaque turn sugars into acids. The acids dissolve minerals from the enamel faster than saliva can restore them, which leads to cavities.', 'It’s a tug of war: acid pulls minerals out of the tooth, saliva pushes them back. Too much sugar, too often, and the acid wins.'),
  'Art:Design': C('Visual hierarchy', 'Visual hierarchy is the arrangement of elements by size, colour, contrast and position so that the viewer notices the most important things first.', 'Think of a movie poster: the star’s face is huge, the title is bold, and the small print at the bottom is the last thing you read.'),
  'Art:Music': C('Harmony', 'Harmony is the combination of different notes played at the same time, forming chords, and the way those chords move from one to the next.', 'A melody is one voice telling the story; harmony is the choir behind it, giving the story its mood.'),
  'Art:Film': C('The 180-degree rule', 'The 180-degree rule keeps the camera on one side of an imaginary line between two characters, so they always face the same directions on screen and the viewer stays oriented.', 'Like watching a match from one side of the stadium: if the camera jumped across, the teams would suddenly seem to switch sides.'),
  'Art:Fine Arts': C('Linear perspective', 'Linear perspective is a drawing technique where parallel lines meet at a vanishing point on the horizon, making flat images look deep.', 'Stand on a long straight road: the edges seem to meet far away. Drawing them that way tricks the eye into seeing depth.'),
  'Engineering:Civil': C('Load distribution', 'Load distribution is how a structure spreads the forces acting on it through its parts, such as beams, columns and foundations, down to the ground.', 'Like a group carrying a heavy table together: if everyone takes a share, nobody gets crushed.'),
  'Engineering:Mechanical': C('Torque', 'Torque is the turning effect of a force. It equals the force multiplied by the perpendicular distance from the pivot to the line of the force.', 'It’s why a long spanner opens a stuck bolt more easily: the same push, further from the centre, turns it harder.'),
  'Engineering:Electrical': C('Ohm’s law', 'Ohm’s law states that the current through a conductor equals the voltage across it divided by its resistance: I = V / R.', 'Think of water in a pipe: pressure is the voltage, the flow is the current, and a narrow pipe is the resistance.'),
  'Engineering:Chemical': C('Mass balance', 'A mass balance applies conservation of mass to a process: what goes in equals what comes out plus what builds up inside (plus or minus what reactions create or use).', 'Like a bank account: money in minus money out tells you how much your balance went up or down.'),
  'Law:Civil Law': C('Breach of contract', 'A breach of contract happens when one party fails to perform what it promised in a binding agreement without a lawful excuse, which allows the other party to seek remedies such as damages.', 'If a teammate promises to pass you the ball and doesn’t, the rules decide what you’re owed for the missed chance.'),
  'Law:Criminal': C('Mens rea', 'Mens rea is the “guilty mind”: the mental element of a crime, such as intention or recklessness, which usually must be proven together with the guilty act (actus reus).', 'Knocking over a glass by accident and throwing it on purpose look alike, but the reason behind the act changes everything.'),
  'Law:Business': C('Limited liability', 'Limited liability means a company’s owners are only responsible for its debts up to the amount they invested; their personal property is protected.', 'Like betting only the chips on the table: if the hand is lost, your house is safe.'),
  'Law:International': C('State sovereignty', 'State sovereignty is the principle that each state has supreme authority over its own territory and affairs, and that other states should not interfere in them.', 'Every player rules their own base. Others can trade or make deals, but they can’t walk in and change your rules.'),
  'Other:School': C('Photosynthesis', 'Photosynthesis is the process by which plants use light energy to turn carbon dioxide and water into glucose and oxygen.', 'A leaf is a solar-powered kitchen: sunlight is the stove, water and air are the ingredients, and sugar is the meal.'),
  'Other:Languages': C('Verb conjugation', 'Verb conjugation is how a verb changes its form to show who is doing the action and when, for example tense, person and number.', 'Like a player changing kit for home and away games: the same player, a different look for each match.'),
  'Other:Exams': C('Spaced repetition', 'Spaced repetition means reviewing information at increasing intervals over time, which leads to better long-term memory than reviewing it all at once.', 'Watering a plant a little every few days keeps it alive far better than flooding it once a month.'),
  'Other:Other': C('Spaced repetition', 'Spaced repetition means reviewing information at increasing intervals over time, which leads to better long-term memory than reviewing it all at once.', 'Watering a plant a little every few days keeps it alive far better than flooding it once a month.'),
};

export const conceptFor = (field?: string, sub?: string): Concept => CONCEPTS[`${field}:${sub}`] ?? CONCEPTS['Other:Exams'];

/** Google's "Learn Your Way" study (2025): the source for the one number shown on the first explanation. */
export const LEARN_YOUR_WAY = 'https://research.google/blog/learn-your-way-reimagining-textbooks-with-generative-ai/';
