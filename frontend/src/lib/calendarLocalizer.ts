import { format, parse, startOfWeek, getDay, addDays } from 'date-fns';
import { dateFnsLocalizer } from 'react-big-calendar';
import enUS from 'date-fns/locale/en-US'; // Or your preferred locale

const locales = {
  'en-US': enUS,
};

// Ensure Monday is the start of the week for consistency with ISO dayOfWeek
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date) => startOfWeek(date, { weekStartsOn: 1 }), // 1 = Monday
  getDay,
  locales,
});

export default localizer;