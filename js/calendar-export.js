/* ─── ICS Calendar Export Utility ─── */
const CalendarExport = (() => {

  function _formatDate(d) {
    const dt = new Date(d);
    return dt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }

  function _escICS(s) {
    return (s || '').replace(/[,;\\]/g, m => '\\' + m).replace(/\n/g, '\\n');
  }

  function generateICS(events) {
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Mason Dining//Marketing Platform//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Mason Dining Events',
    ];

    events.forEach(ev => {
      const start = ev.startDate || ev.date || new Date().toISOString();
      const end = ev.endDate || new Date(new Date(start).getTime() + 2 * 60 * 60000).toISOString();
      lines.push('BEGIN:VEVENT');
      lines.push('UID:' + (ev.id || Math.random().toString(36)) + '@masondining.com');
      lines.push('DTSTART:' + _formatDate(start));
      lines.push('DTEND:' + _formatDate(end));
      lines.push('SUMMARY:' + _escICS(ev.title || ev.name || 'Event'));
      lines.push('DESCRIPTION:' + _escICS(ev.description || ''));
      lines.push('LOCATION:' + _escICS(ev.location || 'George Mason University'));
      lines.push('STATUS:CONFIRMED');
      lines.push('END:VEVENT');
    });

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  function downloadICS(events) {
    const ics = generateICS(events);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mason-dining-events.ics';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportUpcoming() {
    const campaigns = Store.getCampaigns();
    const events = campaigns.filter(c => c.type === 'event' || c.startDate).map(c => ({
      id: c.id,
      title: c.name || c.title,
      description: c.description || '',
      startDate: c.startDate,
      endDate: c.endDate,
      location: c.location || c.venue || 'George Mason University',
    }));
    if (events.length === 0) {
      alert('No events to export.');
      return;
    }
    downloadICS(events);
  }

  return { generateICS, downloadICS, exportUpcoming };
})();
