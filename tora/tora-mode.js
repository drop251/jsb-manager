/* JSB Manager — Tora, couche narrative Éveil Judo 4-5 ans.
 * Les 24 correspondances sont éditoriales, non des fiches techniques importées.
 * La sélection, le dosage, la sécurité et les durées restent dans JSB Manager.
 */
(function (root) {
  'use strict';
  const ENTREES = [["Salut et repères du dojo","Tora découvre le dojo","Montre à Tora où se rassembler, puis salue avec lui."],["Parcours libre entre plots","Tora traverse la jungle","Traverse la jungle en regardant où tu poses tes pieds."],["Chemin d’appuis au sol","Tora et les pierres magiques","Pose tes pieds sur les pierres pour aider Tora à traverser."],["Enroulement statique du dos","Tora devient une petite boule","Fais un dos rond comme Tora, puis reviens doucement assis."],["Quadrupédie libre","Tora rencontre la tortue","Suis doucement la tortue à quatre pattes."],["Transferts de poids sans poussée","Tora et le vent puissant","Penche-toi un tout petit peu puis retrouve ton équilibre."],["Déplacement coordonné en binôme","Tora retrouve son ami","Marche avec ton ami à la même vitesse."],["Identifier les parties de son judogi","Tora découvre son judogi","Montre à Tora une manche puis un revers."],["Contourner un objet au sol","Tora protège son trésor","Fais le tour du trésor sans le toucher."],["Parcours de réinvestissement individuel","Le grand défi de Tora","Aide Tora à réussir les trois missions, sans aller vite."],["Suivi de marques directionnelles","Les empreintes du tigre","Pose tes pieds sur les traces pour retrouver le chemin."],["Pivot et réorientation","La porte des bambous","Tourne doucement et repars vers la porte."],["Stabilité debout","Le rocher immobile","Reste aussi tranquille qu’un rocher pendant dix petites secondes."],["Imitation motrice en duo","Le miroir magique","Regarde ton ami et fais le même geste doucement."],["Saisie douce et relâchement du judogi","Le judogi mystérieux","Prends doucement la manche, puis lâche quand Tora le dit."],["Transport d’objet en binôme","Le courrier des amis","Porte le courrier avec ton ami sans aller plus vite que lui."],["Bascule arrière assise de faible amplitude","La colline arrondie","Assieds-toi, fais le dos rond et balance-toi tout doucement."],["Rotation latérale allongée","Les feuilles de l’automne","Roule doucement sur le côté comme une feuille."],["Quadrupédie dirigée avec virages","La cabane secrète","Avance à quatre pattes et trouve la sortie sans heurter les rochers."],["Contourner un partenaire immobile au sol","La tortue et le tigre","Fais le tour de ton ami sans le toucher."],["Passage sous arche souple fixe","Les petits ponts","Passe sous le petit pont sans le toucher."],["Ramasser et transporter des objets au sol","Le trésor des îles","Ramasse un trésor et dépose-le sur la bonne île."],["Orientation vers des signaux visuels","La boussole de Tora","Regarde le signe et rejoins la bonne île."],["Circuit coopératif de trois ateliers connus","Le cercle des explorateurs","Aide ton équipe à retrouver les étoiles en utilisant tes mouvements préférés."]];
  // Récits originaux JSB : uniquement une couche de présentation, jamais une prescription.
  const HISTOIRES = [
    "Tora arrive dans un dojo inconnu. Pour ouvrir sa porte magique, il cherche comment dire bonjour et où retrouver ses amis.",
    "Tora traverse une jungle de grands arbres. Les animaux dorment : il doit passer sans toucher leurs maisons.",
    "Tora doit traverser une rivière enchantée pour retrouver ses amis. Seules les pierres au sol lui montrent le chemin.",
    "Tora découvre la cachette secrète du petit hérisson. Il doit se faire tout rond pour entrer.",
    "Une tortue montre à Tora comment explorer le sol autrement. Il veut suivre ses petites traces.",
    "Un grand vent souffle dans la savane ! Tora doit bouger comme un roseau sans tomber.",
    "Tora retrouve un ami perdu. Ils doivent rentrer ensemble sans se séparer.",
    "Tora s’est habillé pour son premier cours, mais il a oublié les noms de son judogi.",
    "Tora trouve un trésor dans le dojo. Il doit vérifier tout autour pour le garder en sécurité.",
    "Tora prépare sa première aventure complète. Il veut montrer ses trois nouveaux pouvoirs : marcher, garder l’équilibre et s’arrêter.",
    "Tora découvre ses empreintes dans le dojo. Peut-être conduisent-elles à sa maison secrète ?",
    "Une porte de bambous apparaît devant Tora. Elle s’ouvre seulement quand il change de direction.",
    "Tora se transforme en rocher pour que le vent ne le déplace pas.",
    "Tora découvre un miroir qui peut bouger ! Pour l’activer, il faut lui montrer des gestes.",
    "Tora connaît ses manches, mais il doit apprendre à reconnaître celles de son ami sans lui faire mal.",
    "Tora a une lettre pour ses amis. Elle ne peut arriver que si deux judokas la transportent ensemble.",
    "Tora gravit une toute petite colline. Pour redescendre, il se fait rond comme une boule.",
    "Tora observe les feuilles qui tournent dans le vent. Il veut apprendre à tourner sur le sol comme elles.",
    "Tora entre dans une cabane secrète, mais le chemin tourne derrière des rochers.",
    "L’amie tortue de Tora s’est arrêtée au milieu du chemin. Il faut lui tourner autour sans la déranger.",
    "Tora découvre un passage secret dans une montagne. Il doit adapter sa taille pour traverser.",
    "Les trésors de Tora sont dispersés sur des îles. Il veut les ramener un par un au dojo.",
    "Tora a perdu sa boussole. Les couleurs du dojo lui donnent maintenant la bonne direction.",
    "Tora organise la fête des explorateurs. Chaque équipe doit retrouver trois étoiles en montrant ce qu’elle sait faire."
  ];
  if (HISTOIRES.length !== ENTREES.length) throw new Error('Catalogue Tora incomplet');
  const MODES = ['sans','courtes','aventure'];
  function norm(value) {
    return String(value == null ? '' : value).normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'').toLowerCase()
      .replace(/[^a-z0-9]+/g,' ').trim();
  }
  // Éviter toute association silencieusement écrasée lors d'un ajout éditorial.
  const noms = ENTREES.map(function (r) { return norm(r[0]); });
  if (new Set(noms).size !== ENTREES.length || ENTREES.some(function (r) {
    return !norm(r[0]) || !String(r[1] || '').trim() || !String(r[2] || '').trim();
  })) throw new Error('Associations Tora invalides ou dupliquées');
  const PAR_NOM = new Map(ENTREES.map(function (r,i) {
    return [norm(r[0]), { id:'JSB-TORA-'+String(i+1).padStart(3,'0'),
      nomTechnique:r[0], titre:r[1], consigne:r[2], histoire:HISTOIRES[i] }];
  }));
  function estEveil(groupe) {
    const g=norm(groupe);
    if (!/\beveils?\b/.test(g)) return false;
    const ages = g.match(/\b\d+\b/g) || [];
    // Sans âge précisé, le groupe « Éveils » reste compatible avec la nomenclature du générateur.
    // Avec un âge explicite, limiter aux enfants de 4–5 ans.
    return ages.length === 0 || (ages.every(function (age) { return age === '4' || age === '5'; }) && ages.includes('4') && ages.includes('5'));
  }
  function mode(mode) { return MODES.indexOf(mode)>=0 ? mode : 'sans'; }
  function actif(espace, groupe, choix) {
    return norm(espace)==='judo' && estEveil(groupe) && mode(choix)!=='sans';
  }
  function trouver(exercice) {
    const e=exercice||{};
    if (norm(e.typeFiche)==='technique') return null;
    const disciplines=Array.isArray(e.public) ? e.public : (e.public ? [e.public] : []);
    if (disciplines.length && !disciplines.some(function (v) { return norm(v)==='judo'; })) return null;
    const opposition=norm(e.niveauOpposition);
    if (opposition && !['sans opposition','cooperation','cooperation sans resistance','aucune'].includes(opposition)) return null;
    const publics=Array.isArray(e.sousGroupes) ? e.sousGroupes : e.sousGroupes ? [e.sousGroupes] : [];
    if (publics.length && !publics.some(estEveil)) return null;
    const s=PAR_NOM.get(norm(e.nom || e.Nom || e.name));
    return s || null;
  }
  function pourEnfant(exercice, choix) {
    const modeAffichage=mode(choix);
    const s=trouver(exercice); if (!s || modeAffichage==='sans') return null;
    return { titre:s.titre,
      consigne:modeAffichage==='aventure' ? (s.histoire+' '+s.consigne) : s.consigne,
      id:s.id };
  }
  // Diagnostic non destructif : les fiches Judo importées peuvent rester locales à l'appareil.
  function auditerCatalogue(catalogue) {
    const base=Array.isArray(catalogue) ? catalogue
      : catalogue && Array.isArray(catalogue.exercices) ? catalogue.exercices : null;
    if (!base) throw new TypeError('Catalogue attendu : tableau ou objet { exercices: tableau }');
    const parNom=new Map();
    base.forEach(function (e) {
      if (!e || typeof e!=='object') return;
      const n=norm(e.nom || e.Nom || e.name);
      if (!n) return;
      if (!parNom.has(n)) parNom.set(n, []);
      parNom.get(n).push(e);
    });
    const details=ENTREES.map(function (row,i) {
      const id='JSB-TORA-'+String(i+1).padStart(3,'0');
      const possibles=parNom.get(norm(row[0])) || [];
      const eligibles=possibles.filter(function (e) {
        // Une fiche sans discipline ou tranche d'âge explicite doit être vérifiée,
        // pas présentée comme une correspondance prête pour l'Éveil.
        const disciplines=Array.isArray(e.public) ? e.public : (e.public ? [e.public] : []);
        const groupes=Array.isArray(e.sousGroupes) ? e.sousGroupes : (e.sousGroupes ? [e.sousGroupes] : []);
        if (!disciplines.some(function (v) { return norm(v)==='judo'; }) ||
            !groupes.some(estEveil)) return false;
        const correspondance=trouver(e);
        return correspondance && correspondance.id===id;
      });
      const statut=eligibles.length>1 ? 'doublon' : eligibles.length===1 ? 'prete'
        : possibles.length ? 'incompatible' : 'absente';
      const fiche=eligibles.length===1 ? eligibles[0] : null;
      return {id:id, nomTechnique:row[0], statut:statut,
        exerciceId:fiche ? (fiche.id == null ? fiche.ref || null : fiche.id) : null};
    });
    return {
      totalHistoires:details.length,
      pretes:details.filter(function (d) { return d.statut==='prete'; }).length,
      absentes:details.filter(function (d) { return d.statut==='absente'; }).length,
      incompatibles:details.filter(function (d) { return d.statut==='incompatible'; }).length,
      doublons:details.filter(function (d) { return d.statut==='doublon'; }).length,
      details:details
    };
  }
  const intro='Aujourd’hui, Tora a besoin de nous pour réussir ses missions au dojo. Nous allons apprendre en jouant et en nous aidant.';
  const conclusion='Tora nous remercie pour nos essais, notre attention et notre entraide. Nous terminons par le salut.';
  const api=Object.freeze({norm,estEveil,mode,actif,trouver,pourEnfant,auditerCatalogue,intro,conclusion,
    modes:MODES.slice(),nombre:ENTREES.length});
  if (typeof module==='object' && module.exports) module.exports=api;
  root.JSBTora=api;
})(typeof globalThis!=='undefined' ? globalThis : this);
