// 感想・報告の非公開保存先。
// Supabase 接続後に ChatGPT からこの2項目を設定します。
// anonKey はブラウザー公開前提のキーです。service_role キーは絶対にここへ置かないでください。
window.KOMOREBI_FEEDBACK_CONFIG = {
  supabaseUrl: '',
  anonKey: '',
  table: 'feedback_reports'
};
