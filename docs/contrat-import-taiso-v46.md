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
