import { format, getDay, parse, startOfWeek } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import { dateFnsLocalizer } from 'react-big-calendar';

const locales = {
    'en-US': enUS,
};

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
    getDay,
    locales,
});

export default localizer;
