# JSB Manager — recette du catalogue Taïso V46

**Statut : préparation documentaire, aucun import V46 exécuté.**

## Sources repérées dans la bibliothèque du projet (21 novembre 2026)

- `JSB_Taiso_V46_20_Fiches_Normalisees_A_VALIDER.xlsx` : **lot de 20 fiches à valider** ; la présence du fichier ne constitue pas une validation des lignes.
- `JSB_Taiso_V46_Controle_Normalisation_244_NON_IMPORT.xlsx` : **244 entrées de contrôle**, explicitement **NON IMPORT** ; ne jamais traiter ce fichier comme un catalogue prêt à diffuser.
- Le protocole précédent V34, cinq fiches, reste conservé en `recette-import-taiso-pilote.md` à titre d'historique.
- Le nombre antérieur de 223 fiches et la mention de 27 exclusions ne sont **pas** considérés comme la composition certifiée du fichier V46. La correspondance entre versions reste à établir par identifiants réels.

> Limite : les originaux V46 ont été identifiés dans la bibliothèque, mais les octets bruts n'étaient pas accessibles pour exécuter un contrôle ligne par ligne. Aucun bilan de contenu, aucune conversion et aucun résultat de test n'est revendiqué.

## Gate 0 — inventaire des sources

À remplir à partir des originaux accessibles, sans reconstruire les noms ni les IDs :

| Source | Nombre attendu d'après le nom | Nombre réellement lu | SHA-256 | Décision |
|---|---:|---:|---|---|
| V46_20_Fiches_Normalisees_A_VALIDER | 20 | NON TESTÉ | NON CALCULÉ | Validation en attente |
| V46_Controle_Normalisation_244_NON_IMPORT | 244 | NON TESTÉ | NON CALCULÉ | Interdit d'import |

Les comptes indiqués dans les noms sont des **indices documentaires**, pas des résultats de lecture.

## Gate 1 — conformité pédagogique et technique des 20 fiches

Une feuille de décision par ligne doit comporter : ID source, nom, discipline, famille, sous-famille, niveau, sous-groupe, équipement, muscles cibles, format, moment, dosage (répétitions et/ou durée), point de sécurité, critère de réussite, variantes +/-, accessibilité, inspiration, état (VALIDÉ / À CORRIGER / REFUSÉ) et justification.

- L'exercice est utilisable en **Taïso** et ne doit pas entrer par défaut dans le générateur Judo.
- Une valeur importante non vérifiable reste **À CORRIGER**, jamais comblée silencieusement.
- Les dosages par temps et par répétitions doivent conserver les valeurs exactes.
- Vérifier les adaptations aux publics hétérogènes ; ne pas créer de recommandations cliniques non autorisées.
- Conserver les identifiants et les noms validés ; l'ID est la clé de rapprochement privilégiée.
- Identifier explicitement les fiches `Technique` si le modèle de données l'autorise, sans les traiter à tort comme exercices ordinaires.

**Gate 1 = GO** uniquement si 20 décisions documentées, aucune fiche refusée dans le paquet candidat et aucune incohérence bloquante.

## Gate 2 — séparation des 244 entrées NON IMPORT

- Le classeur de contrôle **ne doit pas être importé** en l'état.
- Classer chaque entrée selon : `déjà conforme`, `correction nécessaire`, `doublon`, `hors périmètre`, `à examiner`.
- Ne pas supposer que les 244 lignes sont 244 exercices uniques.
- Construire une table de rapprochement par ID et nom normalisé pour détecter recouvrements avec les 20 fiches et les anciens lots, sans fusion automatique.
- Vérifier séparément la liste historique des 27 exclusions ; aucune correspondance 1:1 n'est présumée.

## Gate 3 — compatibilité applicative et non-régression

L'application doit être testée avec un **fichier de test dérivé des 20 fiches**, et non avec le contrôle NON IMPORT.

1. Vérifier le format natif réellement accepté par l'interface : `.xlsx`, `.csv`, `.json` ou autre. Ne pas promettre d'import Excel sans test.
2. Prévisualiser la totalité du lot : 20 lignes, aucun effet persistant avant confirmation.
3. Vérifier la correspondance des **15 champs** demandés dans le cahier des charges et les clés effectivement comprises par le parseur.
4. Importer dans un profil isolé et après sauvegarde chiffrée vérifiée.
5. Rejouer le même import : **0 doublon**, **0 ID modifié**.
6. Introduire volontairement une ligne erronée dans une **copie** : le lot entier doit être refusé sans écriture partielle.
7. Contrôler les filtres familles, niveaux, matériel, accessibilité et sélection dans le générateur Taïso.
8. Contrôler qu'une génération Judo n'est pas contaminée.
9. Tester fermeture/réouverture puis sauvegarde/restauration.
10. Exécuter `node --test tests/*.test.cjs` et contrôler Safari/iPhone PWA (hors ligne, cache, stockage).

**Gate 3 = GO** seulement si tous les contrôles sont concluants, avec preuves enregistrées.

## Critères finaux GO / NO GO

| Indicateur | Seuil GO | Résultat observé |
|---|---|---|
| Fiches V46 du lot candidat revues | 20 / 20 | NON TESTÉ |
| Fiches refusées dans le lot candidat | 0 | NON TESTÉ |
| Fiches du contrôle 244 importées par erreur | 0 | NON TESTÉ |
| Identifiants altérés | 0 | NON TESTÉ |
| Doublons créés au réimport | 0 | NON TESTÉ |
| Fiches hors lot modifiées | 0 | NON TESTÉ |
| Échec d'import atomique | 0 écriture partielle | NON TESTÉ |
| Sauvegarde + restauration de test | Conforme | NON TESTÉ |
| Suite CI | Réussie | À VÉRIFIER |
| Recette Safari/PWA | Réussie | NON TESTÉ |

**Décision actuelle : NO GO pour un import en production** ; elle reflète l'absence de résultats vérifiés, pas un défaut présumé des fiches.

## Journal de décision staff

- Responsable contrôle catalogue :
- Responsable applicatif :
- Version de l'application et SHA :
- Format de l'importeur effectivement reconnu :
- Journal des 20 lignes :
- Journal de rapprochement des 244 entrées :
- Confirmation sur les 27 exclusions historiques :
- Sauvegarde vérifiée :
- Incidents / correctifs :
- Visa final :

## Précontrôle automatisé ajouté sur la branche QA

Un script **non destructif** `scripts/taiso-preflight.cjs` reçoit uniquement un export **JSON** (tableau ou `{ "exercices": [...] }`). Il ne lit pas directement un classeur Excel ; aucune équivalence avec l'importeur natif de l'application n'est présumée.

```sh
node scripts/taiso-preflight.cjs chemin/vers/lot-v46.json 20
node --test tests/taiso-v46-preflight.test.cjs
```

Le script vérifie : identifiants absents ou répétés, nom absent, discipline différente de Taïso, détection préventive des noms répétés, vérification indicative de six champs fondamentaux et **blocage par nom** des fichiers portant `NON_IMPORT`. Il ne prétend pas certifier les quinze champs du cahier des charges et ne valide pas les 20 lignes sans le fichier réel. Un résultat `A_VALIDER` ne permet jamais une mise en production.

La suite CI générale peut échouer sur des tests d'interface préexistants ; le statut d'exécution doit être vérifié après chaque commit. Une correction du test de clic de filtre a été faite sur cette branche de recette uniquement.

## Rapprochement documentaire des 20 fiches avec les 244 contrôles

L'outil `scripts/taiso-rapprochement.cjs` compare **deux exports JSON** en lecture seule, sans import ni fusion :

```sh
node scripts/taiso-rapprochement.cjs chemin/vers/candidats-v46.json chemin/vers/controle-v46_NON_IMPORT.json > rapport-rapprochement.json
node --test tests/taiso-v46-rapprochement.test.cjs
```

Le second nom de fichier doit contenir `NON_IMPORT`. La commande n'accède pas aux fichiers Excel directement. Les catégories calculées sont : `CORRESPONDANCE_ID_NOM`, `CONFLIT_CONTENU`, `CONFLIT_ID_NOM`, `NOM_SEUL`, `AMBIGU_REFERENCE`, `AMBIGU_CANDIDATS`, `INCOMPLET` et `AUCUNE_CORRESPONDANCE`. Le rapport contient les lignes sources correspondantes et renvoie systématiquement `NO_GO_IMPORT` ; même les concordances ID/nom doivent être validées par une personne responsable. Les écarts de dosage, consignes de sécurité, critère de réussite, famille, sous-famille, niveau, format ou matériel sont signalés lorsqu'ils sont comparables. Un champ manquant dans une source reste non comparable, jamais déclaré identique.

**Important :** aucune comparaison réelle V46 n'a été exécutée tant que les deux exports ne sont pas accessibles. Les comptes 20 et 244 sont issus des noms des classeurs, pas du traitement des lignes.
