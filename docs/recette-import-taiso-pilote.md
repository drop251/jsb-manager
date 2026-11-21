# Recette d'import — catalogue Taïso (lot pilote de cinq exercices)

**État : protocole de recette, non exécuté sur le fichier source.** Ce document ne signifie pas que le fichier Excel a été intégré. La branche `main` ne doit pas être modifiée par cette recette avant validation.

## Périmètre
- Discipline : **Taïso uniquement**.
- Premier lot : **5 exercices** provenant du fichier pilote fourni par l'équipe, à identifier par leurs IDs et noms réels dans le procès-verbal.
- Lot élargi : **223 fiches préparées**, sous réserve de validation du nombre exact et des IDs dans le fichier source.
- **27 exclusions** : quarantaine logique, aucune réintégration automatique et aucune suppression en production par simple import.
- Préserver l'historique des séances, les images personnelles et les fiches anciennes.

## Prérequis de sécurité
1. Exporter une sauvegarde chiffrée complète de l'espace avant toute manipulation.
2. Effectuer la recette dans un profil ou appareil de test, pas directement sur l'espace de travail utilisé en cours.
3. Conserver une copie immuable du fichier source et noter son empreinte SHA-256.
4. Vérifier si le sélecteur d'import de la version testée accepte réellement `.xlsx`. Sinon convertir une **copie** du pilote en format explicitement accepté, sans prétendre à une compatibilité native Excel.
5. Ne pas importer le lot de 223 fiches avant la réussite du pilote.

## Matrice de recette

| ID | Scénario | Action | Résultat attendu |
|---|---|---|---|
| TAI-01 | Lecture | Charger le pilote cinq lignes dans le format admis par l'application | Prévisualisation de cinq exercices, champs reconnus, aucune écriture avant confirmation |
| TAI-02 | Contrat de données | Contrôler les noms, IDs, discipline, familles, sous-familles, niveau, format, accessibilité, matériel, dosage et sécurité | Valeurs intactes, sans reclassement silencieux ni champ vide essentiel |
| TAI-03 | Générateur | Générer une séance Taïso avec filtres compatibles puis incompatibles | Sélection limitée aux fiches éligibles, manque signalé si aucune fiche valide |
| TAI-04 | Idempotence | Réimporter exactement le même pilote | Aucun doublon ni changement d'ID, médias et données associées conservés |
| TAI-05 | Atomicité | Introduire dans une copie de test une ligne invalide parmi quatre valides | Refus explicite du lot entier, aucune écriture partielle |
| TAI-06 | Conservation | Modifier une fiche existante à ID inchangé dans une copie de test | Mise à jour contrôlée, séance/historique et médias conservés |
| TAI-07 | Échec d'écriture | Simuler un échec de stockage en environnement de test | Erreur visible, données originales inchangées |
| TAI-08 | Persistance | Fermer et rouvrir l'application de test après un import réussi | Cinq fiches identiques à la version pré-fermeture |
| TAI-09 | Sauvegarde/restauration | Sauvegarder l'espace de test, restaurer sur espace de test vierge | Fiches et métadonnées identiques après restauration |
| TAI-10 | Exclusions | Soumettre séparément une ligne de chacune des trois classes : à adapter, à examiner, à exclure | Aucun passage automatique des 27 lignes dans le catalogue publié |

## Contrôles structurels minimaux

Pour chaque fiche, renseigner un tableau de correspondance entre **colonnes source** et **champs internes**. Comparer les valeurs brutes et celles issues de l'aperçu, puis les valeurs stockées. Les champs fondamentaux sont : nom, point de sécurité, dosage de base, critère de réussite, famille, niveau, sous-groupe, matériel, muscles cibles, moment de séance, variantes + et -, accessibilité, inspiration et format. Le nom interne exact des champs doit être vérifié contre le parseur de la version testée ; ne pas présumer une correspondance automatique.

Règles bloquantes : discipline manquante ou incohérente ; identifiant ambigu ou dupliqué ; format de champ invalide ; fiche incomplète selon le validateur effectif ; tentative d'écriture partielle d'un lot refusé ; altération d'une fiche hors lot ; perte de média ou de séance.

## Procès-verbal à compléter

- Version de l'application / SHA du commit :
- Appareil, navigateur et mode (web / PWA) :
- Nom exact du pilote, format et SHA-256 :
- IDs et noms des 5 exercices :
- Nombre de lignes lues / acceptées / refusées :
- Tests TAI-01 à TAI-10 : résultat **OK / KO / NON TESTÉ**, preuve et anomalie éventuelle :
- Nombre de fiches avant / après import :
- Nombre de doublons : 
- Résultat de la restauration :
- Décision : **GO** (autoriser lot élargi) / **NO GO** (corriger et recommencer) :
- Validation coach / responsable technique :

## Conditions de passage au lot élargi

**GO uniquement si** TAI-01 à TAI-09 sont OK, que TAI-10 confirme l'isolement des exclusions, que le compteur de doublons vaut **0**, que **0 fiche hors lot** a été modifiée et que la restauration d'essai est conforme. À défaut : **NO GO**. Le lot élargi doit être sauvegardé et importé avec la même discipline de contrôle, en journalisant chaque ligne rejetée.

## Automatisation déjà disponible

La CI du dépôt exécute `node --test tests/*.test.cjs` sur les PR vers `main`. Les tests existants dans `tests/catalogue.test.cjs` et `tests/import-corrections.test.cjs` couvrent plusieurs protections (types, doublons, classement, refus global, transaction de corrections). Ils ne remplacent **pas** le test réel des cinq lignes Excel ni le test Safari/iPhone.