export const parseSafeDate = (dateString: string | null | undefined): Date => {
  if (!dateString) return new Date();
  
  // Extract only the date part YYYY-MM-DD
  // Handles strings like "2026-07-25 00:00:00+00" or "2026-07-25T00:00:00.000Z"
  const datePart = dateString.split('T')[0].split(' ')[0];
  
  const [year, month, day] = datePart.split('-');
  
  if (!year || !month || !day) return new Date();
  
  // Create date in local timezone at midnight
  return new Date(Number(year), Number(month) - 1, Number(day));
};
