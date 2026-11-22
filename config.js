// הגדרות האפליקציה — זה הקובץ היחיד שצריך לערוך
// ברירת מחדל: ייצור (הגיליון האמיתי). לעבודה מול עותק הבדיקה: לפתוח פעם אחת עם ‎?test=1‎ בכתובת
// (נזכר במכשיר; ‎?test=0‎ מחזיר לייצור). בסביבת בדיקה מופיע פס צהוב למעלה.
(function () {
  const PROD = 'https://script.google.com/macros/s/AKfycbzpPxYMw8U230VcERXJWSgHKtF15gXvl0xwT6PRBQpUQrr5ML1pb9iyRuw2GJIL8edVWw/exec';
  const TEST = 'https://script.google.com/macros/s/AKfycbzvnlXScWH_6IejTilqrboKANH0f3fP7c_2TenZZmsuUWbMifEAZBRmCGel-RN0OG1lbw/exec';
  let test = false;
  try {
    const q = new URLSearchParams(location.search).get('test');
    if (q === '1') localStorage.setItem('mk_env_test', '1');
    if (q === '0') localStorage.removeItem('mk_env_test');
    test = localStorage.getItem('mk_env_test') === '1';
  } catch (e) {}
  window.APP_CONFIG = { API_URL: test ? TEST : PROD };
})();
