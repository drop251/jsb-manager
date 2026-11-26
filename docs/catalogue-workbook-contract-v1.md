# JSB Manager — contrat Excel JSB-EXCEL-1
Statut : contrat technique V1 développé sur la branche V36. Validation finale des nouvelles recettes et validation pédagogique distinctes. Les modèles ne constituent pas une autorisation de publication.

## Périmètre et sources
- Classeur de recette fourni : JSB_Taiso_228_Import_Recette.xlsx, onglet Exercices, 228 fiches et 22 colonnes textuelles.
- Source normative technique : core/catalogue-workbook-contract.cjs, core/catalogue-workbook-analysis.cjs, core/catalogue-import.cjs, core/catalogue-details.cjs.
- Règles Judo existantes : README.md, sections générateur Judo et dosage. Les données Judo définitives et Tora restent hors intégration.
- Ce contrat n'implique pas que les générateurs authentifiés soient raccordés ni que les référentiels aient reçu une validation pédagogique.

## Règles communes
Un fichier XLSX par discipline, un seul onglet visible nommé Exercices. En-têtes exacts en ligne 1, aucun changement de nom ou d'ordre, une fiche par ligne, aucune ligne vide interne, aucun titre intermédiaire, formule, macro ou objet incorporé. Les lignes vides en fin de feuille sont tolérées. Les modèles vierges servent à la saisie et ne peuvent pas être importés comme un catalogue vide.
Les deux modèles contiennent 300 lignes préparées ; le lecteur accepte jusqu'à 2 000 fiches dans les limites de volume. Limites techniques : XLSX 4 Mio, archive décompressée 32 Mio, JSON canonique 4 Mio, 2 000 fiches, 100 erreurs détaillées au maximum. Le rapport indique le total des erreurs. Pas de modification silencieuse du texte, pas de déduction des dosages depuis la description, pas d'ajout artificiel de données.
Référence unique, stable, en majuscules : JSB-TAISO- ou JSB-JUDO- suivi de 1 à 60 caractères ASCII A-Z, 0-9, tiret, underscore ; le premier caractère du suffixe est alphanumérique. Ne jamais réutiliser un identifiant pour un autre exercice ni le recalculer depuis le numéro de ligne. Les références RECETTE- sont interdites de publication. Les doublons sont refusés (comparaison normalisée insensible à la casse).
Nom : 250 caractères maximum ; famille principale : 120 ; autres champs textuels : 1 800 maximum ; détails canoniques : 30 000 octets maximum. Référence, nom et famille sans espaces en bordure. Cellules textuelles non vides pour les champs requis, sans caractère NUL. Les nombres sont des entiers positifs (cellules Excel numériques entières ou texte entier). Version du catalogue saisie dans JSB Admin : 1 à 80 caractères A-Z a-z 0-9 _ . -, jamais RECETTE-. Les versions déjà publiées ne sont pas écrasées.
Tous les champs du modèle sont requis sauf Tags, Restrictions d’utilisation et les champs chiffrés conditionnels (durée d'effort, répétitions, repetitionsMax). Une absence de matériel, de prérequis, de variante ou d'inspiration doit être explicitée avec une valeur exacte et justifiée ; ne pas inventer une réponse pour passer le contrôle.

## En-têtes Taïso — ordre exact (27)
Référence | Nom (exercice) | Exécution | Discipline | Type de fiche | Point de sécurité | Dosage de base | Critère de réussite | Famille principale | Sous-famille | Niveau | Sous-groupe | Matériel | Muscles cibles | Moment de la séance | Variante plus facile | Variante plus difficile | Accessibilité | Inspiration | Format | Catégorie | Tags | Objectif | Mode de dosage | Durée d’effort (s) | Répétitions | Restrictions d’utilisation

Discipline = Taïso ; Type de fiche = Exercice. Niveau : Débutant, Intermédiaire, Expert. Sous-groupe : Gym douce ; Training ; Gym douce, Training (ce dernier est une seule valeur, à saisir telle quelle). Ces valeurs sont issues du classeur provisoire. Famille principale, sous-famille, catégorie, moment, format et matériel restent textuels à ce stade ; une nomenclature exhaustive doit être validée avant le raccordement des générateurs.
Mode de dosage :
- Répétitions : Répétitions requises ; durée d'effort vide.
- Durée : durée d'effort requise ; répétitions vides.
- Durée et répétitions : les deux champs requis ; deux prescriptions alternatives, non un plafond. Le coach choisit un mode adapté à sa séance.
Dosage de base décrit les séries, répétitions/temps, récupérations et modalités réelles. Les nombres structurés sont distincts du texte et doivent être cohérents avec lui. Durée d'effort 1–7200 secondes ; répétitions 1–10000 (bornes techniques, non des recommandations). Les tags textuels restent préservés, pas de découpage automatique.

## En-têtes Judo — ordre exact (35)
Référence | Nom (exercice) | Exécution | Discipline | Type de fiche | Point de sécurité | Dosage de base | Critère de réussite | Famille principale | Sous-famille | Niveau | Sous-groupe | Matériel | Moment de la séance | Variante plus facile | Variante plus difficile | Accessibilité | Inspiration | Format | Catégorie | Tags | Objectif | Catégories d’âge | Grade | Compétence ciblée | Rôle pédagogique | Prérequis | Niveau d’opposition | Organisation | dureeBlocMin | modeDosageJudo | Durée d’effort (s) | Répétitions | repetitionsMax | Restrictions d’utilisation

Discipline = Judo ; Type de fiche = Exercice. Pas de champ Muscles cibles ni des sous-groupes Taïso imposés. Niveau, sous-groupe, grade, famille, sous-famille, catégorie et format sont textuels. Catégories d’âge : Éveils, Pré-poussins, Poussins, Benjamins, Minimes, Cadets, Juniors, Adultes ; plusieurs catégories séparées par un point-virgule, sans doublons.
Rôle pédagogique : Préparation, Découverte, Acquisition, Consolidation, Réinvestissement, Application, Opposition, Retour au calme.
Niveau d’opposition : Sans opposition, Coopération, Opposition dirigée, Opposition libre. Éveils : Sans opposition ou Coopération ; pas de technique formelle ni randori (contrôle pédagogique manuel). Pré-poussins : pas d’opposition libre.
Compétence ciblée, rôle pédagogique, prérequis, niveau d'opposition, organisation (Tori/Uke, rotations, récupération selon situation) et durée du bloc sont obligatoires pour ce nouveau contrat. dureeBlocMin est une estimation de planification de 1 à 120 minutes, et non le chronomètre d'effort. Choix V1 plus strict que le format historique en répétitions, à confirmer avant finalisation pédagogique.
modeDosageJudo :
- Répétitions : Répétitions requises ; durée d'effort et repetitionsMax vides.
- Durée : durée d'effort requise ; Répétitions et repetitionsMax vides.
- Durée + répétitions max : durée d'effort et repetitionsMax requis ; Répétitions vide ; exclusivement Benjamins, Minimes, Cadets, Juniors, Adultes (toutes les catégories de la fiche doivent être admissibles). Plafond par judoka.
Durée d'effort 1–7200 secondes ; répétitions et plafond 1–10000. Bornes techniques, non prescriptions. Le dosage textuel doit préciser les séries/alternances/récupérations. Ne pas confondre durée du bloc et effort, ni imposer du chronométrage aux exercices en répétitions.

## Dictionnaire pédagogique commun
Exécution : étapes et consignes observables ; point de sécurité : posture, appuis, matériel, limites et arrêt ; dosage : quantité et récupération ; critère de réussite : résultat vérifiable ; famille/sous-famille : classement ; niveau/sous-groupe : public et difficulté ; matériel : matériel réellement nécessaire ; moment : place dans la séance ; variantes : adaptations concrètes de difficulté ; accessibilité : conditions d'accès ; inspiration : provenance si connue ; format : solo, binôme, groupe ou autre organisation réelle ; catégorie : classification ; tags : texte de recherche ; objectif : finalité. Muscles cibles Taïso : groupes musculaires réellement sollicités. Restrictions : conditions spécifiques, aucune invention ; exclure toute fiche non validée ou à risque jusqu'à résolution.

## Grille de contrôle avant import
1. Discipline et version confirmées, aucun mélange Judo/Taïso.
2. En-têtes stricts, aucune formule/colonne inconnue, aucune ligne vide interne.
3. Références pérennes uniques ; pas d'identifiant provisoire ; maintien des références lors d'une révision.
4. Champs obligatoires réels, valeurs de nomenclature et modes chiffrés cohérents.
5. Validation humaine de chaque fiche : exactitude, sécurité, accessibilité, variantes, dosage, objectifs et restrictions ; aucune fiche exclue ou non validée.
6. Judo : âge, grade, opposition, prérequis et organisation adaptés ; pas de Tora ni d'exercice exploratoire.
7. Analyse JSB Admin sans écriture ; contrôle du nombre de fiches, familles, erreurs, échantillon et empreinte SHA-256 ; corriger le fichier puis relancer.
8. Publication distincte après recette complète, confirmation administrative, contrôle de l'empreinte et de la version précédente. À ce stade aucun bouton de publication réel n'est activé.
9. Vérifier la réversibilité, les filtres et les générateurs avec un lot approuvé. Les catalogues et données privées demeurent indépendants.

## Limites de clôture
Le contrat et les modèles sont développés. Les nouvelles recettes CI et les essais avec les deux classeurs remplis doivent être confirmés. Le moteur de publication transactionnelle a été testé précédemment, mais son parcours depuis l'interface, le raccordement du générateur authentifié, l'hébergement, la validation humaine des fiches et les taxonomies complètes restent des conditions de mise en service. Les formats et bornes V1 sont des choix techniques explicitement révisables, pas des recommandations d'entraînement.
