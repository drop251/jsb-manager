'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Pool}=require('pg');
const {readConfig}=require('../../preproduction-server.cjs');
const {preflight}=require('../../../scripts/preflight-preproduction.cjs');
test('Prévol réel sur base de préproduction éphémère, sans ouverture externe',async()=>{
 assert.equal(process.env.PGDATABASE,'jsb_preprod');
 const pool=new Pool({max:2});
 try{
  assert.equal((await pool.query('SELECT current_database() AS name')).rows[0].name,'jsb_preprod');
  const key=n=>Buffer.alloc(32,n).toString('base64url');
  const config=readConfig({
   JSB_ENV:'preproduction',JSB_PUBLIC_ORIGIN:'https://manager.example.test',JSB_ADMIN_ORIGIN:'https://admin.example.test',
   DATABASE_URL:'postgresql://localhost/jsb_preprod',JSB_QUOTA_KEY:key(1),JSB_DELIVERY_KEY:key(2),JSB_MFA_KEY:key(3),JSB_GATEWAY_KEY:key(4),
   JSB_DELIVERY_KEY_ID:'fixture-delivery',JSB_MFA_KEY_ID:'fixture-mfa',JSB_XLSX_PYTHON:process.env.JSB_XLSX_PYTHON
  });
  const result=await preflight({config,pool});
  assert.equal(result.readyForPrivatePreview,true);
  assert.equal(result.excelReader,true);
  assert.equal(result.checks,23);
  assert.equal(result.externalHttpsVerified,false);
  assert.equal(result.productionReady,false);
  for(const name of ['accounts','sessions'])assert.equal((await pool.query('SELECT count(*) AS n FROM jsb_auth.'+name)).rows[0].n,'0');
 }finally{await pool.end();}
});
