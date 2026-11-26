'use strict';
// Run only on the operator's own computer, from a private terminal.
// No network or third-party dependency. Never commit or share the output.
const {randomBytes}=require('node:crypto');
const {writeFile}=require('node:fs/promises');
const {homedir}=require('node:os');
const {join}=require('node:path');
const {createInterface}=require('node:readline/promises');
const {normalizeEmail}=require('../backend/login-service.cjs');
const {hashPassword}=require('../backend/passwords.cjs');
const {generateSecret,provisioningUri}=require('../backend/admin-mfa.cjs');
async function main(){
 if(!process.stdin.isTTY||!process.stdout.isTTY)throw Error('Terminal privé requis');
 const rl=createInterface({input:process.stdin,output:process.stdout});
 let secret;
 try{
  const adminEmail=normalizeEmail(await rl.question('Adresse e-mail de TEST Admin : '));
  const coachEmail=normalizeEmail(await rl.question('Adresse e-mail de TEST Coach (distincte) : '));
  if(!adminEmail||!coachEmail||adminEmail===coachEmail)throw Error('Adresses distinctes requises');
  if(await rl.question('Je contrôle ces deux adresses de test et accepte leur activation manuelle en préproduction (OUI) : ')!=='OUI')throw Error('Confirmation refusée');
  const adminPassword=randomBytes(24).toString('base64url'),coachPassword=randomBytes(24).toString('base64url');secret=generateSecret();
  const bundle={schema:'JSB-PREPROD-PAIR-1',attestation:'TEST_EMAILS_CONTROLLED',adminEmail,coachEmail,adminHash:await hashPassword(adminPassword),coachHash:await hashPassword(coachPassword),totpSecret:secret.toString('base64url')};
  const filename=join(homedir(),'jsb-preprod-activation-'+randomBytes(8).toString('hex')+'.json');
  await writeFile(filename,JSON.stringify(bundle),{mode:0o600,flag:'wx'});
  console.log('Fichier privé à utiliser uniquement dans JSB_TEST_PAIR_BUNDLE sur Render : '+filename);
  console.log('Admin : '+adminEmail+'\nMot de passe Admin : '+adminPassword);
  console.log('Coach : '+coachEmail+'\nMot de passe Coach : '+coachPassword);
  console.log('URI TOTP Admin à enregistrer dans votre application MFA :\n'+provisioningUri(secret,adminEmail));
  console.log('Conservez les deux mots de passe et le facteur MFA dans votre gestionnaire sécurisé. Supprimez le fichier et la variable Render après activation. Fermez ce terminal privé.');
 }finally{if(secret)secret.fill(0);rl.close();}
}
main().catch(()=>{console.error('Préparation locale refusée. Aucun identifiant ne doit être transmis à ChatGPT.');process.exitCode=1;});
