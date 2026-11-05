import { React } from '../../vendor/react-runtime.js';

// Attach mobile labels to register tables. The capacity calendar keeps its
// horizontal layout, and print documents are handled by their own styles.
function ResponsiveTables() {
  React.useEffect(() => {
    const root = document.getElementById('root');
    function labelTables() {
      root.querySelectorAll('table').forEach(table => {
        const headings = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
        if (table.closest('.timesheet-paper, .challan-paper, .manufacturing-paper, .work-order-sheet,.availability-chart')) {
          table.classList.remove('mobile-cards');
          table.querySelectorAll('[data-label]').forEach(cell => cell.removeAttribute('data-label'));
          return;
        }
        if (headings.length < 3 || table.classList.contains('capacity-table')) return;
        table.classList.add('mobile-cards');
        table.querySelectorAll('tbody tr').forEach(row => Array.from(row.cells).forEach((cell, index) => {
          const label = headings[index] || 'Actions';
          if (cell.dataset.label !== label) cell.dataset.label = label;
        }));
      });
    }
    const observer = new MutationObserver(labelTables);
    observer.observe(root, { childList: true, subtree: true });
    labelTables();
    return () => observer.disconnect();
  }, []);
  return null;
}

export { ResponsiveTables };
