# Contrat d'import JSB Manager — vérifications V46

Date de revue : 2026-11-21. Source : README et tests sur la branche principale du dépôt.

## Deux parcours à ne pas confondre

| Parcours | Points établis | À vérifier sur appareil |
|---|---|---|
| Import d'une base complète | Le JSON complet est validé sur les doublons d'IDs, la discipline et les types de champs, selon les tests existants. | Format exact des fichiers sélectionnables, comportement de l'aperçu, persistance réelle |
| Ajouts/corrections | Le README documente les alias de colonnes et l'aperçu avant écriture. Les corrections et images sont enregistrées en transaction IndexedDB. | Import de l'export V46, correspondance de chaque colonne, doublons entre lots |
| Médias vidéo | Le README signale une écriture séparée, susceptible d'échec individuel. | Résultat de chaque vidéo ; ne pas annoncer un import multimédia atomique |

**Ne pas déduire de la mention de « colonnes Excel » dans les fiches que l'interface accepte nécessairement un fichier `.xlsx` brut.** Une conversion en JSON ou dans un format compatible peut être nécessaire, mais elle doit se faire sur une copie après vérification des champs et sans perte des identifiants.

## Vérifications bloquantes

1. Sauvegarde complète chiffrée vérifiée et profil de test isolé.
2. Sélection du parcours correct (base complète ou ajout/correction) selon la fonction visée.
3. Identification précise des clés canoniques attendues dans l'importeur effectivement utilisé.
4. Rapprochement ID + nom + données pédagogiques ; jamais d'équivalence automatique sur le seul nom.
5. Aperçu des vingt fiches avec tous les champs attendus, sans écriture.
6. Import réel uniquement après décision humaine ; réimport idempotent sans doublons.
7. Contrôle des références historiques dans les séances et du nombre de fiches avant/après.
8. Vidéos et médias personnels vérifiés individuellement si le lot en comporte.
9. Safari iPhone, PWA et restauration après fermeture.

## Situation des sources

Les deux classeurs V46 ont été **identifiés dans la bibliothèque**, mais la récupération de leurs octets bruts a échoué. Il n'est donc **pas possible à ce stade** de donner les ID/nom réels des 20 fiches, le nombre exact de lignes ni les résultats de comparaison avec les 244 entrées NON_IMPORT.

Le protocole automatisé (précontrôle, rapprochement et rapport Markdown) reste opérationnel sur des **exports JSON accessibles**, mais ne prouve pas la validation des classeurs.

**État : NO GO pour l'import en production.** Ne pas fusionner la PR de recette comme validation du catalogue.

## Vérification du code réel de l'importeur (21 novembre 2026)

Lecture directe du blob `index.html` du commit principal `52f69afd7869391bcbf6d61515e1af38fb62c4a0`.

- **ImportBase** : `lireBaseFichier` appelle `fichier.text()` puis `JSON.parse` et vérifie des identifiants obligatoires. Il s'agit du flux de **base complète JSON**, à ne pas utiliser pour les vingt corrections.
- **GestionExercices** : `lireFichierExercices` accepte `.json`, `.csv`/`.txt`, `.zip` et les classeurs lus par `XLSX.read`. Le format `.xlsx` est donc prévu dans le code. Cette vérification du code ne remplace pas une ouverture du classeur V46 sur Safari.
- La conversion `XLSX.utils.sheet_to_json` préserve la colonne `index` si elle existe ; cette colonne n'est **pas** automatiquement renommée en `id` par le lecteur.
- `preparerAjouts` compare une clé formée par **nom normalisé, discipline et type de fiche**. Une correspondance avec fiche existante peut produire une mise à jour sur l'ID existant ; sans correspondance, l'algorithme peut proposer une nouvelle fiche avec un nouvel ID.
- La référence historique de type `JSB-TAISO-RENF-0055` n'est pas une garantie d'ID applicatif. L'aperçu et la base locale de test doivent confirmer le lien avant validation.
- Les tests spécifiques `tests/taiso-v46-lecture-xlsx.test.cjs` utilisent un lecteur XLSX simulé pour vérifier le routage et la conservation des colonnes ; ils **ne chargent pas le fichier XLSX réel**, et ne prouvent pas l'import sur iPhone.

**Décision opérationnelle :** utiliser uniquement le flux **ajouts/corrections** sur un profil isolé sauvegardé. Refuser le lot si l'aperçu indique un ajout inattendu, un doublon, une nouvelle référence ou une modification d'une fiche hors lot.

## Verrou applicatif « NON_IMPORT » dans la PR #56

La fonction réelle `lireFichierExercices(fichier)` de `index.html` refuse désormais **avant lecture** tout nom de fichier contenant `NON_IMPORT` ou `NON IMPORT` (variantes d'espaces, tirets et points). Un message explicite oriente vers un lot de fiches validé.

Cela protège notamment contre une sélection accidentelle du fichier `JSB_Taiso_V46_Controle_Normalisation_244_NON_IMPORT.xlsx`, dont la première feuille est un tableau de pilotage, **pas** les exercices destinés à l'import. La fonction d'ajouts/corrections ne lit plus ce fichier tant que sa dénomination contient la mention de blocage.

Les tests `taiso-v46-lecture-xlsx.test.cjs` couvrent le refus avant chargement, des variantes de nom et la lecture normale d'un fichier candidat `A_VALIDER`.

**Limite explicite :** le verrou est basé sur le **nom du fichier**, et non sur une signature interne ou une certification du contenu. Renommer un fichier de contrôle supprimerait cette protection ; elle ne remplace pas la revue des données, l'aperçu ni une décision de validation humaine. Aucune écriture de base n'a été effectuée dans cette recette.
