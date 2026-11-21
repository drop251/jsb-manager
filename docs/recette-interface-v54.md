# Recette d'intégration — Interface JSB Manager V54

## Périmètre et règle de livraison
Cette recette porte exclusivement sur la consolidation des PR #48 (Mes séances), #49 (bibliothèque) et #50 (Suivi et reprise), réunies dans la PR #55. Elle ne valide pas les PR #51–#54 et #56, ni l'import réel des catalogues.
Ne pas fusionner les PR sources en plus de #55 sans vérifier les différences et éviter les doublons.

## Préconditions
- Conserver une copie de séances de test en stockage navigateur, y compris une séance incomplète et une séance finalisée.
- Tester les deux disciplines (Judo, Taïso) sans mélange de filtres ni de résultats.
- Tester navigateur desktop, Safari iPhone et application ajoutée à l'écran d'accueil.
- Vérifier l'application en ligne, puis en mode hors ligne après préchargement.
- Aucune suppression automatique des séances, des préférences ou du catalogue existant.

## Critères de validation bloquants

| ID | Parcours / contrôle | Résultat attendu |
| --- | --- | --- |
| UI-01 | Ouvrir « Mes séances » sans séance sauvegardée | Message d'état vide compréhensible et action explicite ; aucun bouton inerte |
| UI-02 | Créer une séance, choisir Judo, enregistrer, sortir et revenir | La séance et ses réglages sont conservés ; aucune bascule silencieuse vers Taïso |
| UI-03 | Créer une séance Taïso avec dosage en durée et une avec répétitions | Le mode de dosage enregistré reste celui sélectionné et s'affiche sans ambiguïté |
| UI-04 | Commencer une préparation puis l'annuler | La préparation est abandonnée après action explicite ; les séances précédentes restent intactes |
| UI-05 | Revenir vers l'écran précédent par le geste horizontal sur iPhone | Un seul retour par geste ; aucune navigation accidentelle pendant un défilement ou un champ en cours d'édition |
| UI-06 | Revenir via contrôle visuel en l'absence du geste | Navigation équivalente et accessible au clavier |
| UI-07 | Ouvrir la bibliothèque vide puis remplir la bibliothèque | État vide lisible ; focus visible ; affichage des fiches dès qu'elles existent |
| UI-08 | Ouvrir « Suivi et reprise » | Statut « En préparation » explicite ; aucune fausse promesse de suivi fonctionnel |
| UI-09 | Activer thème clair puis sombre sur les mêmes écrans | Contrastes et focus visibles ; pas de texte coupé ni contrôle masqué |
| UI-10 | Tester largeur iPhone puis desktop | Aucune superposition ; tailles de libellés homogènes ; zones tactiles utilisables |
| UI-11 | Actualiser, fermer et rouvrir l'application avec séances enregistrées | Persistance préservée ; aucun doublon ni perte |
| UI-12 | Précharger, passer hors ligne, rouvrir la PWA | L'interface précédemment mise en cache reste accessible ; aucune promesse d'import ou de synchronisation hors ligne non vérifiée |
| UI-13 | Basculer entre Judo et Taïso dans la bibliothèque | Filtres et catégories propres à chaque discipline ; aucune fusion de données |
| UI-14 | Ouvrir « Mes séances » à l'aide du clavier et d'un lecteur d'écran | Noms de commandes, états, ordre de focus et actions compréhensibles |

## Vérification automatisée
Exécuter depuis la racine du dépôt :
```sh
node --test tests/*.test.cjs
```
Documenter le commit testé, le nombre de tests réussis/échoués et les éventuels tests ignorés. Ce passage ne remplace pas la recette tactile réelle.

## Barrière de fusion
Ne fusionner #55 que si : la suite automatique est verte ; UI-01 à UI-14 sont documentés ; les différences avec #48–#50 sont revues ; l'état du cache PWA est cohérent ; aucune régression de persistance, Judo/Taïso ou navigation n'est constatée.

## Suivi des anomalies
Pour chaque échec : identifiant UI-xx, environnement (macOS/iOS, version Safari, navigateur ou PWA), scénario reproductible, résultat attendu/observé, capture si possible, gravité, correctif et résultat du nouveau test.

**Statut initial de la recette** : non exécutée sur appareil réel. Ne pas confondre présence de ce protocole et validation de la livraison.

## Contrôle CI confirmé — 21 novembre 2026
- Commit évalué : `ccfdc940ebd51a767f63de95c0990339d9c21839`
- GitHub Actions, exécution `44896383547` : **success**.
- Tests JavaScript : **119 réussis, 0 échec, 0 ignoré**.
- Les trois échecs précédents de `tests/seances-suppression.test.cjs` venaient de libellés d'interface modifiés dans la consolidation. Les assertions ont été alignées sur les nouveaux libellés tout en conservant les vérifications de suppression ciblée et de conservation en cas d'échec.
- Avertissement non bloquant : `actions/checkout@v4` utilise une version de Node.js dont le support est en transition ; mise à niveau à traiter séparément.

## Traçabilité des PR sources
- **#48** : libellés « Mes séances », champs et messages d'état vide repris ; adaptations combinées avec #50 pour le statut de suivi.
- **#49** : adaptations de focus, mode modal, bibliothèque vide et tests repris.
- **#50** : visibilité de « Suivi et reprise » et libellé « En préparation » repris ; condition et badge fusionnés avec les changements de #48.
- **Cache PWA** : un seul nom de cache V54 remplace les changements distincts de chaque branche.
- Ce contrôle compare les ajouts de code source des trois PR avec le diff de #55 ; les différences restantes correspondent aux lignes volontairement combinées et aux noms de cache remplacés. Il ne constitue pas une validation fonctionnelle Safari/PWA.

## Points de sortie non vérifiés
- UI-01 à UI-14 : recette manuelle non renseignée, sans présumer d'un succès sur appareil.
- Focus effectif, navigation tactile, persistance après fermeture et cache hors ligne Safari : à éprouver sur appareil réel.
- **Décision** : conserver la PR #55 en brouillon et ne pas fusionner automatiquement.
