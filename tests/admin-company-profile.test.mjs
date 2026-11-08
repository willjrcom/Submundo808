import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const shell=read('artifacts/submundo-808/src/components/admin-shell.tsx');
const profile=read('artifacts/submundo-808/src/components/admin-company-profile.tsx');
const server=read('server/index.mjs');

test('admin preferences now show a company profile instead of inline forms',()=>{
 assert.match(shell,/import AdminCompanyProfile from '\.\/admin-company-profile'/);
 assert.match(shell,/section==='Preferências'&&<AdminCompanyProfile\/>/);
 assert.doesNotMatch(shell,/section==='Preferências'&&<form/);
 assert.doesNotMatch(shell,/databaseEngine|database-status|PostgreSQL conectado|SQLite \(somente desenvolvimento\)/);
 assert.match(profile,/aria-label="Perfil da empresa"/);
 assert.match(profile,/Capa da empresa/);
 assert.match(profile,/Perfil da empresa/);
 assert.match(profile,/>Submundo 808<\/h3>/);
});

test('edit action floats over cover and opens an accessible modal with three tabs',()=>{
 assert.match(profile,/absolute right-3 top-3 z-10/);
 assert.match(profile,/onClick=\{openEditor\} aria-haspopup="dialog"/);
 assert.match(profile,/role="dialog" aria-modal="true" aria-labelledby="company-profile-editor-title"/);
 assert.match(profile,/\['identity','Identidade visual',Palette\]/);
 assert.match(profile,/\['contact','Contato',IdCard\]/);
 assert.match(profile,/\['rules','Regras gerais',FileText\]/);
 assert.match(profile,/Salvar alterações/);
 assert.match(profile,/role="alertdialog" aria-modal="true" aria-labelledby="discard-company-profile-title"/);
 assert.match(profile,/function closeEditor\(\)/);
});

test('company edit restores existing settings and does not modify the database readout',()=>{
 for(const field of ['minimum_age','entry_rules','accepted_documents','cancellation_policy','contact_name','contact_phone']){
  assert.ok(profile.includes(field),'Missing '+field);
 }
 assert.match(profile,/formatMobile\(draft.settings.contact_phone\)/);
 assert.match(profile,/setDraft\(\{\.\.\.profile,settings:\{\.\.\.profile.settings\}\}\)/);
 assert.match(profile,/compressVenueImage\(file,kind\)/);
 assert.match(profile,/applyAccentColor\(saved.color\)/);
 assert.match(profile,/\/api\/admin\/company-profile/);
 assert.doesNotMatch(profile,/PostgreSQL|SQLite/);
});

test('backend migrates optional brand cover without overwriting existing branding',()=>{
 assert.match(server,/ALTER TABLE app_branding ADD COLUMN cover_data TEXT NOT NULL DEFAULT ''/);
 assert.match(server,/SELECT logo_data,cover_data,accent_color FROM app_branding/);
 assert.match(server,/req.method==='GET'&&key==='company-profile'/);
 assert.match(server,/req.method==='POST'&&key==='company-profile'/);
 assert.match(server,/UPDATE app_branding SET logo_data=\?,cover_data=\?,accent_color=\? WHERE id=1/);
 assert.match(server,/UPDATE event_general_settings SET minimum_age=\?,entry_rules=\?,accepted_documents=\?,cancellation_policy=\?,contact_name=\?,contact_phone=\? WHERE id=1/);
 assert.match(server,/db.exec\('BEGIN'\);\s*try\{[\s\S]*?db.exec\('COMMIT'\);\s*\}catch\(error\)\{db.exec\('ROLLBACK'\);throw error;\}/);
 assert.match(server,/req.method==='GET'&&key==='branding'/);
 assert.match(server,/req.method==='POST'&&key==='branding'/);
 assert.match(server,/req.method==='GET'&&key==='accent-color'|req.method==='POST'&&key==='accent-color'/);
});

test('company branding update validates image payloads, color and contact values',()=>{
 assert.match(server,/validImage\(logo,120000\)/);
 assert.match(server,/validImage\(cover,110000\)/);
 assert.match(server,/typeof settings\[key\]!=='string'\|\|settings\[key\].length>5000/);
 assert.match(server,/contactPhone.length!==11/);
 assert.match(server,/Escolha uma cor hexadecimal válida/);
});
