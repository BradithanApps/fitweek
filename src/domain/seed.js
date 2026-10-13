// Ejemplo de ciclo de 5 Días (basado en una rutina real de gimnasio).
// Los nombres se crean en el idioma activo; después son texto del usuario y no se traducen.

import { newId } from './workout.js';
import { nameKey } from './text.js';

const EX = {
  prensa: { es: 'Prensa', pt: 'Leg press', en: 'Leg press' },
  hack: { es: 'Hack', pt: 'Agachamento hack', en: 'Hack squat' },
  extensora: { es: 'Extensora', pt: 'Cadeira extensora', en: 'Leg extension' },
  flexora: { es: 'Flexora', pt: 'Flexora', en: 'Leg curl' },
  flexoraUni: { es: 'Flexora uni', pt: 'Flexora unilateral', en: 'Single-leg curl' },
  gemelos: { es: 'Gemelos', pt: 'Panturrilha', en: 'Calf raise' },
  volador: { es: 'Volador', pt: 'Voador', en: 'Pec deck' },
  pressPlano: { es: 'Press plano', pt: 'Supino reto', en: 'Flat bench press' },
  pressInclinado: { es: 'Press inclinado', pt: 'Supino inclinado', en: 'Incline bench press' },
  paralela: { es: 'Paralela', pt: 'Paralelas', en: 'Dips' },
  tricepsCuerda: { es: 'Tríceps cuerda', pt: 'Tríceps corda', en: 'Rope pushdown' },
  tricepsTesta: { es: 'Tríceps testa', pt: 'Tríceps testa', en: 'Skull crusher' },
  remoPolea: { es: 'Remo polea', pt: 'Remada baixa', en: 'Seated cable row' },
  remoArticulado: { es: 'Remo articulado', pt: 'Remada articulada', en: 'Machine row' },
  remoDorian: { es: 'Remo Dorian', pt: 'Remada Dorian', en: 'Dorian row' },
  facePull: { es: 'Face pull', pt: 'Face pull', en: 'Face pull' },
  voladorInverso: { es: 'Volador inverso', pt: 'Voador invertido', en: 'Reverse pec deck' },
  mesaFlexora: { es: 'Mesa flexora', pt: 'Mesa flexora', en: 'Lying leg curl' },
  sillaFlexora: { es: 'Silla flexora', pt: 'Cadeira flexora', en: 'Seated leg curl' },
  hackPendulo: { es: 'Hack péndulo', pt: 'Agachamento pêndulo', en: 'Pendulum squat' },
  aductora: { es: 'Aductora', pt: 'Cadeira adutora', en: 'Hip adduction' },
  abductora: { es: 'Abductora', pt: 'Cadeira abdutora', en: 'Hip abduction' },
  gemelosParado: { es: 'Gemelos parado', pt: 'Panturrilha em pé', en: 'Standing calf raise' },
  pressMilitar: { es: 'Press militar', pt: 'Desenvolvimento militar', en: 'Military press' },
  elevFrontal: { es: 'Elevación frontal', pt: 'Elevação frontal', en: 'Front raise' },
  elevLateral: { es: 'Elevación lateral', pt: 'Elevação lateral', en: 'Lateral raise' },
  bicepsW: { es: 'Bíceps W', pt: 'Rosca W', en: 'EZ-bar curl' },
  bicepsCuerda: { es: 'Bíceps cuerda', pt: 'Rosca corda', en: 'Rope curl' },
};

const DAYS = [
  { name: { es: 'Piernas', pt: 'Pernas', en: 'Legs' }, items: [['prensa', 4, 10], ['hack', 3, 12], ['extensora', 4, 10], ['flexora', 4, 10], ['flexoraUni', 3, 12], ['gemelos', 3, 10]] },
  { name: { es: 'Pecho', pt: 'Peito', en: 'Chest' }, items: [['volador', 3, 10], ['pressPlano', 4, 10], ['pressInclinado', 4, 10], ['paralela', 3, 12], ['tricepsCuerda', 3, 10], ['tricepsTesta', 3, 10]] },
  { name: { es: 'Espalda', pt: 'Costas', en: 'Back' }, items: [['remoPolea', 4, 10], ['remoArticulado', 4, 10], ['remoDorian', 3, 10], ['facePull', 3, 12], ['voladorInverso', 4, 10]] },
  { name: { es: 'Glúteos', pt: 'Glúteos', en: 'Glutes' }, items: [['mesaFlexora', 3, 10], ['sillaFlexora', 3, 10], ['hackPendulo', 4, 8], ['aductora', 3, 10], ['abductora', 3, 10], ['gemelosParado', 4, 10]] },
  { name: { es: 'Brazos', pt: 'Braços', en: 'Arms' }, items: [['pressMilitar', 5, 10], ['elevFrontal', 4, 10], ['elevLateral', 4, 10], ['tricepsCuerda', 3, 10], ['bicepsW', 3, 12], ['bicepsCuerda', 3, 12]] },
];

/** Devuelve { exercises, cycleDays } listos para guardar. */
export function exampleCycle(lang = 'es') {
  const pick = (names) => names[lang] ?? names.es;
  const ids = {};
  const exercises = Object.entries(EX).map(([slug, names]) => {
    const name = pick(names);
    ids[slug] = newId();
    return { id: ids[slug], name, nameKey: nameKey(name), currentWeight: 0, mode: 'reps', archived: false };
  });
  const cycleDays = DAYS.map((d, i) => ({
    id: newId(),
    order: i,
    name: pick(d.name),
    items: d.items.map(([slug, sets, reps]) => ({ exerciseId: ids[slug], sets, reps, rest: null })),
  }));
  return { exercises, cycleDays };
}
