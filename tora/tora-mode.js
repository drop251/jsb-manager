/* JSB Manager — Tora, couche narrative Éveil Judo 4-5 ans.
 * Les 24 correspondances sont éditoriales, non des fiches techniques importées.
 * La sélection, le dosage, la sécurité et les durées restent dans JSB Manager.
 */
(function (root) {
  'use strict';
  const ENTREES = [["Salut et repères du dojo","Tora découvre le dojo","Montre à Tora où se rassembler, puis salue avec lui."],["Parcours libre entre plots","Tora traverse la jungle","Traverse la jungle en regardant où tu poses tes pieds."],["Chemin d’appuis au sol","Tora et les pierres magiques","Pose tes pieds sur les pierres pour aider Tora à traverser."],["Enroulement statique du dos","Tora devient une petite boule","Fais un dos rond comme Tora, puis reviens doucement assis."],["Quadrupédie libre","Tora rencontre la tortue","Suis doucement la tortue à quatre pattes."],["Transferts de poids sans poussée","Tora et le vent puissant","Penche-toi un tout petit peu puis retrouve ton équilibre."],["Déplacement coordonné en binôme","Tora retrouve son ami","Marche avec ton ami à la même vitesse."],["Identifier les parties de son judogi","Tora découvre son judogi","Montre à Tora une manche puis un revers."],["Contourner un objet au sol","Tora protège son trésor","Fais le tour du trésor sans le toucher."],["Parcours de réinvestissement individuel","Le grand défi de Tora","Aide Tora à réussir les trois missions, sans aller vite."],["Suivi de marques directionnelles","Les empreintes du tigre","Pose tes pieds sur les traces pour retrouver le chemin."],["Pivot et réorientation","La porte des bambous","Tourne doucement et repars vers la porte."],["Stabilité debout","Le rocher immobile","Reste aussi tranquille qu’un rocher pendant dix petites secondes."],["Imitation motrice en duo","Le miroir magique","Regarde ton ami et fais le même geste doucement."],["Saisie douce et relâchement du judogi","Le judogi mystérieux","Prends doucement la manche, puis lâche quand Tora le dit."],["Transport d’objet en binôme","Le courrier des amis","Porte le courrier avec ton ami sans aller plus vite que lui."],["Bascule arrière assise de faible amplitude","La colline arrondie","Assieds-toi, fais le dos rond et balance-toi tout doucement."],["Rotation latérale allongée","Les feuilles de l’automne","Roule doucement sur le côté comme une feuille."],["Quadrupédie dirigée avec virages","La cabane secrète","Avance à quatre pattes et trouve la sortie sans heurter les rochers."],["Contourner un partenaire immobile au sol","La tortue et le tigre","Fais le tour de ton ami sans le toucher."],["Passage sous arche souple fixe","Les petits ponts","Passe sous le petit pont sans le toucher."],["Ramasser et transporter des objets au sol","Le trésor des îles","Ramasse un trésor et dépose-le sur la bonne île."],["Orientation vers des signaux visuels","La boussole de Tora","Regarde le signe et rejoins la bonne île."],["Circuit coopératif de trois ateliers connus","Le cercle des explorateurs","Aide ton équipe à retrouver les étoiles en utilisant tes mouvements préférés."]];
  const MODES = ['sans','courtes','aventure'];
  function norm(value) {
    return String(value == null ? '' : value).normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'').toLowerCase()
      .replace(/[^a-z0-9]+/g,' ').trim();
  }
  const PAR_NOM = new Map(ENTREES.map(function (r,i) {
    return [norm(r[0]), { id:'JSB-TORA-'+String(i+1).padStart(3,'0'),
      nomTechnique:r[0], titre:r[1], consigne:r[2] }];
  }));
  function estEveil(groupe) {
    const g=norm(groupe);
    return /\beveils?\b/.test(g) && (/4 5/.test(g) || (!/\b(6|7|8|9|10|11|12)\b/.test(g)));
  }
  function mode(mode) { return MODES.indexOf(mode)>=0 ? mode : 'sans'; }
  function actif(espace, groupe, choix) {
    return norm(espace)==='judo' && estEveil(groupe) && mode(choix)!=='sans';
  }
  function trouver(exercice) {
    const e=exercice||{};
    if (e.typeFiche==='Technique') return null;
    const opposition=norm(e.niveauOpposition);
    if (opposition && !['sans opposition','cooperation','aucune'].includes(opposition)) return null;
    const publics=Array.isArray(e.sousGroupes) ? e.sousGroupes : e.sousGroupes ? [e.sousGroupes] : [];
    if (publics.length && !publics.some(estEveil)) return null;
    const s=PAR_NOM.get(norm(e.nom || e.Nom || e.name));
    return s || null;
  }
  function pourEnfant(exercice, choix) {
    const s=trouver(exercice); if (!s || mode(choix)==='sans') return null;
    return { titre:s.titre, consigne:s.consigne, id:s.id };
  }
  const intro='Aujourd’hui, Tora a besoin de nous pour réussir ses missions au dojo. Nous allons apprendre en jouant et en nous aidant.';
  const conclusion='Tora nous remercie pour nos essais, notre attention et notre entraide. Nous terminons par le salut.';
  const api=Object.freeze({norm,estEveil,mode,actif,trouver,pourEnfant,intro,conclusion,
    modes:MODES.slice(),nombre:ENTREES.length});
  if (typeof module==='object' && module.exports) module.exports=api;
  root.JSBTora=api;
})(typeof globalThis!=='undefined' ? globalThis : this);
