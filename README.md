# JSB Manager

Application de préparation physique, judo, taïso et suivi des présences — Judo Sans Barrières.

Installable sur iPhone (Safari › Partager › Sur l’écran d’accueil). Les données personnelles restent sur l’appareil ; aucune synchronisation entre appareils n’est fournie.

La base principale d’exercices est importée sur l’appareil. Le dépôt contient dix exercices illustrés publics et un catalogue supplémentaire chiffré.

## Sauvegarder et restaurer

Depuis **Présences › Sauvegarde**, ou **Mon compte › Sauvegarder tout mon espace**, créez une sauvegarde chiffrée. Elle contient les présences, le planning, les séances, les favoris, la sélection, les routines, la base importée, les exercices ajoutés et les images, illustrations et vidéos personnelles. Les médias personnels sont communs aux profils de l’appareil ; la sauvegarde contient ceux de cet appareil. Les médias du catalogue publié sont téléchargés séparément.

Le mot de passe est conservé uniquement en mémoire pendant l’ouverture de la page. Les anciennes valeurs enregistrées en clair sont supprimées à l’ouverture. Conservez votre mot de passe dans un gestionnaire : il reste nécessaire pour ouvrir les fichiers déjà exportés.

Après le partage ou le téléchargement, vérifiez la présence du fichier avant de confirmer sa conservation. Annuler l’export ou cette confirmation ne change pas la date de dernière sauvegarde.

La restauration complète remplace les données du profil actif, la base importée, les médias personnels communs et les réglages inclus. Exportez l’espace actuel avant de restaurer. Les écritures IndexedDB sont effectuées dans une seule transaction ; les réglages locaux sont rétablis si cette transaction échoue. Les anciennes sauvegardes de présences restent lisibles et conservent leur ancien périmètre.

## Préparer une séance hors ligne

Ouvrez l’application avec une connexion, puis une séance en direct. Utilisez **Préparer hors ligne** et attendez sa confirmation. Cette action met en cache le catalogue et les médias nécessaires à la séance, et vérifie les vidéos personnelles. Répétez la préparation après modification de la séance. Les vidéos mises en cache prennent en charge les requêtes par plages de Safari.

L’état hors ligne dépend du stockage conservé par le navigateur. Le minuteur et les signaux en arrière-plan ne sont pas garantis : gardez l’application visible pendant le cours.

## Vérifications

Sans dépendance supplémentaire :

```sh
node --test tests/reliability.test.cjs
```

Les tests couvrent le chiffrement, la restauration des vidéos, les anciens fichiers, les annulations de partage et téléchargement, la confirmation de conservation, l’échec de stockage, les médias hors ligne et les plages vidéo.

La vérification physique sur Safari iPhone reste nécessaire pour le partage, la lecture des vidéos et la disposition en portrait/paysage.

## Mise à jour du générateur (1er novembre 2026)

- Les préférences du générateur, modèles Taïso et brouillons de préparation Judo/Taïso sont inclus dans les nouvelles sauvegardes complètes chiffrées. Les sauvegardes antérieures restent lisibles ; elles ne contiennent pas rétroactivement ces éléments.
- Les brouillons de « Ma séance » récupèrent les informations et dosages saisis après une fermeture ou un rechargement, sur le même appareil et le même profil.
- La génération Taïso respecte les filtres de niveau, d'accessibilité et les contraintes du groupe. Si le catalogue contient trop peu d'exercices compatibles, l'application signale les manques au lieu d'élargir silencieusement les niveaux.
- Le choix explicite « Sans matériel » limite les propositions au poids du corps et au tatami. Sans équipement sélectionné et sans ce mode, le comportement historique (tout matériel disponible) reste conservé.
- La répartition temporelle des phases respecte 45, 60, 75 ou 90 minutes. Les remplacements sont priorisés selon la catégorie, la zone de travail et la technique plutôt qu'au hasard.
- Deux préparations du même jour et du même cours peuvent être enregistrées séparément ; les écritures qui échouent ne sont plus annoncées comme réussies.

**Précision :** les calculs de la séance proposée et les durées réellement animées par l'éducateur peuvent différer selon les transitions pédagogiques. Valider sur iPhone les écrans, les supports importés et l'utilisation hors ligne avant une utilisation en cours. L'application indépendante Moniteur JSB ne fait pas partie de ce dépôt.

## Interface de préparation simplifiée (1er novembre 2026)

- L'écran Taïso conserve ses réglages essentiels visibles ; les modèles, le matériel détaillé et les adaptations au groupe sont repliés par défaut et restent accessibles avec un résumé de la sélection. Aucun filtre existant n'est effacé lors de l'ouverture ou la fermeture de ces rubriques.
- « Remplacer » affiche désormais jusqu'à cinq exercices compatibles et classés par pertinence : rien ne change tant que l'éducateur n'a pas choisi un remplaçant. Le retrait, le remplacement et le dosage peuvent être annulés avec « Annuler la dernière retouche ».
- Le nombre d'exercices et la durée de la proposition sont affichés dans l'en-tête de la séance ; les minutes des exercices d'une même phase (hors blocs de travail) sont réparties sans dépasser sa durée totale.
- Le cache hors ligne a changé de version pour déclencher l'installation de la nouvelle interface. Si l'ancienne version reste affichée sur l'écran d'accueil iPhone, ouvrir l'app avec une connexion puis la relancer après mise à jour du service worker.

Les tests automatiques vérifient les calculs et le flux de remplacement. Ils ne remplacent pas une vérification ergonomique et fonctionnelle sur un véritable iPhone.

## Correction : annuler une préparation de séance (1er novembre 2026)

- **Générer une séance**, en Judo comme en Taïso : un bouton « Annuler la préparation » est visible à chaque étape et sur la proposition. Fermer depuis le fond de fenêtre ou la touche Échap demande aussi confirmation.
- Une génération abandonnée ne modifie plus les préférences enregistrées du générateur ; les préférences et la routine choisie sont enregistrées après validation effective dans « Ma séance ».
- **Ma séance** : « Annuler la préparation » efface, après confirmation, les exercices sélectionnés ainsi que les informations et durées du brouillon courant. Les séances enregistrées dans l'historique ne sont pas supprimées. Un échec de stockage laisse le brouillon intact et affiche un message.
- La proposition transférée dans « Ma séance » est consommée une seule fois : elle ne se réinstalle plus après navigation entre les écrans.
- Correction de deux fonctions homonymes de matériel qui perturbaient les listes de matériel des circuits Taïso et des modèles.
- La navigation automatique de l'assistant Judo ne dépend plus d'un délai de 120 ms ; une erreur de génération affiche un message explicite au lieu d'un écran cassé.

Après mise à jour sur iPhone, rouvrir JSB Manager avec une connexion pour recevoir la nouvelle version hors ligne. Contrôler les parcours sur un véritable appareil avant emploi en cours.


## Objectifs pédagogiques Judo (3 novembre 2026)

- Le générateur **Judo** propose désormais huit objectifs propres à l'apprentissage : Découverte et initiation ; Apprentissage technique ; Perfectionnement technique ; Déplacements et déséquilibres ; Enchaînements et combinaisons ; Défense et contre-attaques ; Travail au sol — Ne-waza ; Opposition et randori.
- La sélection privilégie les exercices dont le nom, la thématique, la famille technique ou la description correspondent à l'objectif choisi, tout en conservant les filtres par catégorie d'âge et les techniques sélectionnées.
- Si aucun exercice ciblé n'est disponible pour un objectif dans la tranche d'âge choisie, un avertissement s'affiche : le générateur ne prétend pas avoir couvert cet objectif.
- Les objectifs et le fonctionnement du générateur **Taïso** restent inchangés. Les catégories physiques internes des fiches Judo sont conservées pour le classement existant.
- Contrôles : validation de la syntaxe JavaScript et tests automatisés sur les correspondances d'objectifs, les séances Judo/Taïso et les opérations de sauvegarde ; vérification visuelle sur iPhone restant nécessaire.


## Générateur Judo : critères pédagogiques et contrôle des imports (4 novembre 2026)

Six données pédagogiques supplémentaires sont prises en compte pour les fiches Judo :
- `competenceCiblee` : apprentissage précis visé (texte explicite).
- `rolePedagogique` : `Préparation`, `Découverte`, `Acquisition`, `Consolidation`, `Réinvestissement`, `Application`, `Opposition` ou `Retour au calme`.
- `prerequis` : compétence devant être acquise avant l'exercice, ou `Aucun`.
- `niveauOpposition` : `Sans opposition`, `Coopération`, `Opposition dirigée` ou `Opposition libre`.
- `organisation` : consignes d'organisation, rôle de Tori/Uke en binôme ou trio, alternances/rotations, récupération.
- `dureeBlocMin` : durée indicative de planification en minutes, facultative si le dosage est en répétitions (et non un chronomètre de l'exercice).

Les cinq premiers champs pédagogiques sont obligatoires pour les nouvelles fiches Judo ; le sixième critère est le **dosage vérifiable**, qui n'impose plus de durée à une prescription en répétitions. Les informations de base restent obligatoires : nom, description, thématique, dosage, vigilance, critère de réussite, catégorie d'âge, grade, famille technique, moment, format, matériel, variante facile et difficile. Les données absentes provoquent un **refus détaillé** avant enregistrement. Le refus d'une fiche bloque l'import entier (pas de chargement partiel). Les images et vidéos ajoutées seules à un exercice existant ne nécessitent pas une nouvelle fiche complète. Une fiche ancienne déjà présente n'est pas supprimée ni bloquée parce qu'elle ne possède pas encore les six nouvelles données.

Une fiche existante importée avec ses mêmes nom/public, une description complète et les nouveaux champs est **mise à jour sur son identifiant actuel**, sans création de doublon ; ses images et vidéos sont conservées. Une correction incomplète d'une fiche existante est refusée. Les familles techniques explicitement renseignées sont préservées.

Le générateur Judo utilise les champs pédagogiques enrichis pour prioriser les compétences correspondantes, contrôler les rôles par phase et les prérequis déclarés, limiter les niveaux d'opposition et tenir compte de l'organisation et des durées réalistes. Les anciens exercices sans métadonnées restent disponibles, mais la séance signale les durées estimées et les éventuels manques. Les remplacements d'exercices tiennent compte des mêmes critères. Le générateur Taïso reste indépendant.

Dans le générateur Judo, ouvrir **Critères pédagogiques avancés** à l'étape Technique pour préciser, si nécessaire, la compétence ciblée, les prérequis acquis, l'opposition maximale, l'organisation et la durée cible des blocs. Le rôle pédagogique est déduit de chaque phase, puis comparé aux champs des fiches. Les notes d'organisation sont aussi visibles dans la proposition et l'export PDF.

Les tests exécutés sous Node.js couvrent la validation des champs, le refus d'import, les reprises de fiches existantes, la conservation des médias et la répartition des durées. Une validation finale des parcours et de la lisibilité des fiches PDF sur iPhone reste nécessaire ; la présence de six champs ne garantit pas à elle seule la pertinence d'une séance.

## Trames Judo par âge : PDF indicatif, génération libre (4 novembre 2026)

La **fiche de séance PDF est un modèle indicatif**, pas un contrat rigide sur les intitulés ou sur les durées de la séance. Le générateur conserve cinq temps d'organisation pour aider à répartir le cours, mais **affiche des libellés pédagogiques différents** selon l'âge. Les intitulés et, pour les plus jeunes, les budgets de phase sont ajustables dans « Ma séance » avant le PDF. Les phases techniques internes restent les mêmes pour conserver la compatibilité de la sélection et de l'historique. Les anciennes séances déjà enregistrées (trame 2) gardent leurs anciens intitulés ; les nouvelles utilisent la trame 3.

- **Éveils Judo (4–5 ans)** : accueil et salut ; jeux moteurs ; parcours moteurs ; jeux coopératifs ; retour au calme. Pas de technique formelle ni de randori ; la sélection priorise les activités motrices, ludiques et la coopération. L'accueil et les pauses peuvent exister sans fiche d'exercice artificielle.
- **Pré-poussins (6–7 ans)** : accueil et mobilité ; jeux moteurs ; bases du Judo ; opposition éducative ; retour au calme. Les situations d'opposition restent dirigées et progressives, sans randori libre imposé.
- **Poussins, Benjamins, Minimes, Cadets, Juniors et Adultes** : intitulés évolutifs, du jeu et de l'apprentissage initial aux situations technico-tactiques et randori des plus grands. Le choix de l'objectif, les prérequis, les rôles et les niveaux d'opposition continuent à gouverner les exercices, indépendamment des titres.
- **Taïso** : conserve son générateur et ses intitulés propres, sans reprendre la trame d'Éveil Judo.
- **Durées** : propositions adaptées à la catégorie (par exemple 30 à 60 minutes pour l'Éveil), mais elles ne proviennent pas du PDF et ne servent pas de verrou de génération. Le moteur jeunes accepte les durées saisies de 20 à 120 minutes, en signalant les séances d'Éveil inhabituellement longues.
- **Catalogue incomplet** : les temps d'accueil, de consignes, de transitions et de salut sont affichés comme tels. Le moteur indique les activités manquantes et ne prétend pas avoir proposé un exercice inexistant.
- **Parcours du générateur** : la routine initiale Judo est facultative et le choix d'une famille technique n'est pas obligatoire en Éveil ou en Pré-poussins. Les prérequis explicitement exigés par une fiche ne sont pas présumés acquis.

La mise à jour comporte des tests automatisés sur les différentes trames, l'absence de techniques formelles en Éveil, les oppositions dirigées en Pré-poussins, la conservation des anciennes trames et le total des minutes. La vérification sur iPhone et la validation pédagogique de séances issues du catalogue réel restent nécessaires.

## Dosage Judo : répétitions, durée et plafond à partir des Benjamins

Le `dosage` d'une fiche Judo n'est **pas** le temps attribué à cette fiche dans le planning. Les répétitions, séries, rôles et récupérations sont prioritaires. Le générateur distingue maintenant les modes :
- `modeDosageJudo = Répétitions` : quota décrit dans `dosage` ou `repetitions`, avec les séries et rotations. `dureeBlocMin` facultatif. Une récupération de 30 s n'est pas confondue avec un exercice chronométré.
- `modeDosageJudo = Durée` : temps d'effort réellement défini dans `dosage` ou `duree_s`. Une `dureeBlocMin` seule ne suffit pas à inventer un chronomètre.
- `modeDosageJudo = Durée + répétitions max` : nécessite **une durée d'effort** et `repetitionsMax` (entier positif, maximum **par judoka**). Ce mode est réservé aux **Benjamins, Minimes, Cadets, Juniors et Adultes**. Il est refusé si une fiche vise aussi les Poussins, Pré-poussins ou Éveils. Une fiche multi-âges doit être divisée lorsqu'elle utilise ce mode.

Les noms de colonnes Excel exacts restent : `dureeBlocMin` (facultatif selon le dosage), `modeDosageJudo` et `repetitionsMax` (nécessaire seulement au mode combiné). Le mode peut être déduit de `dosage` lorsqu'il est sans ambiguïté ; **aucun maximum n'est inventé** si le catalogue n'en renseigne pas. Les fiches dont le dosage est illisible restent refusées avec une explication détaillée. Le refus reste global à l'import en cas de fiche incomplète, comme avant cette évolution.

Le générateur Judo propose les modes compatibles avec l'âge dans **Critères pédagogiques avancés** ; les durées de phase sont des durées d'organisation. Le PDF de la séance affiche le dosage et, le cas échéant, le plafond des répétitions. Le mode séance directe conserve les séries des exercices en répétitions et peut afficher une durée associée à un maximum de répétitions lorsque ce mode est validé.

Le Taïso conserve sa logique indépendante. Les séances et catalogues historiques ne sont pas effacés par la mise à jour. Les tests Node.js couvrent l'inférence des trois modes, l'import conditionnel, les catégories d'âge, la distinction effort/planning, les séries et la présence du maximum sur la fiche PDF. La validation pédagogique de la prescription et l'essai sur iPhone restent nécessaires.


## Catalogue par familles (17 novembre 2026)

Le catalogue Judo/Taïso propose une famille principale, un filtre de sous-famille lorsqu’elle est renseignée, et des en-têtes de groupes dans la liste. Les compteurs de familles portent sur le public sélectionné ; les autres filtres et la recherche déterminent le nombre de résultats affichés. Au-delà de dix familles, un sélecteur remplace les boutons pour limiter l’encombrement.

Les champs `famillePrincipale`, `famille`, `sousFamille` et `tags` sont conservés à l’ajout et dans les exports de fiches. La famille principale explicite est prioritaire, puis l’ancienne famille. Sans ces champs, la navigation Judo utilise la famille technique déjà déclarée ; une fiche non identifiable reste dans « À classer ». En Taïso, la catégorie existante sert de famille de secours. Ce regroupement d’affichage ne réécrit pas la base, les identifiants, les favoris ni les médias. Il ne constitue pas un audit pédagogique du catalogue personnel.

La recherche couvre les familles, sous-familles et tags. Le tri « Nom » respecte désormais l’ordre alphabétique. Les filtres détaillés de format, matériel et type de travail sont accessibles dans les deux disciplines ; le Taïso dispose aussi de l’accessibilité et de la zone de travail. Sans matériel coché, tous les équipements restent autorisés ; le tatami est inclus dans le socle Taïso.

Les fiches placent l’organisation et le critère de réussite parmi les informations pédagogiques et replient les commandes de médias/export. L’historique propose les séances plus anciennes par lots de trente. Le retour tactile se déclenche uniquement depuis le bord gauche et ignore les contrôles et fenêtres.

L’import complet JSON refuse les identifiants en double, les disciplines inconnues et les types de champs incompatibles avant toute écriture. Il conserve la compatibilité des anciennes fiches sans les nouveaux champs pédagogiques ; les contrôles détaillés de l’ajout Judo restent distincts. Un refus indique la ligne et la raison.

Deux corrections de dosage accompagnent cette version : « récup 30 s » ne devient plus une durée d’effort et le mode combiné conserve ses séries/récupérations en séance directe.

Validation : `node --test tests/*.test.cjs` couvre les règles, les imports et des parcours de composants simulés (famille, sous-famille, recherche et filtres). Ces tests ne rendent pas les écrans dans un navigateur. La validation visuelle et tactile sur Safari iPhone reste à effectuer. La refonte complète du parcours de préparation et la séparation des types de fiches restent des chantiers suivants.


## Préparation simplifiée (17 novembre 2026)

Dans « Ma séance », le groupe, la thématique, la durée et l’objectif restent visibles. Les options et notes pédagogiques, le renommage des phases et les commandes secondaires (PDF et annulation) sont repliés. Les actions Enregistrer et Lancer sont regroupées ; le générateur mène à cet écran avec « Continuer dans Ma séance ».

L’état distingue une version enregistrée dans l’historique d’un brouillon à enregistrer. Toute retouche de son contenu fait réapparaître cet état de brouillon. Ce repère reste en mémoire pendant l’ouverture de la page ; après rechargement, une préparation récupérée doit être enregistrée pour obtenir de nouveau cette confirmation. Il ne certifie pas la pertinence pédagogique de la séance.

Les valeurs proposées non modifiées (groupe, durée, objectif, etc.) sont désormais enregistrées explicitement dans les informations de la séance et transmises au mode direct. Les valeurs personnalisées restent sélectionnables. Une reprise dont l’écriture échoue conserve le brouillon. L’export PDF s’arrête et laisse l’erreur visible si l’enregistrement dans l’historique échoue.

Validation : 69 tests automatisés passent, dont des parcours de composants simulés couvrant l’enregistrement des valeurs proposées, le lancement, les retouches et les échecs de stockage. La validation visuelle et tactile sur Safari iPhone reste à effectuer.


## Fiches techniques et exercices (17 novembre 2026)

Le catalogue dispose des vues Tout, Exercices et Fiches techniques. `typeFiche` accepte les valeurs exactes `Exercice` et `Technique` dans une base JSON ou un fichier d’ajout (colonne « Type de fiche »). Une fiche sans ce champ conserve le comportement historique d’un exercice : aucun reclassement automatique ni changement d’identifiant.

Une fiche technique sert de référence : elle reste consultable, illustrable et exportable, mais ne propose pas d’ajout direct à la sélection. Elle est exclue des générations Judo/Taïso, des routines et des remplacements du générateur, y compris pour les plus jeunes. Les anciennes sélections et séances déjà enregistrées ne sont pas supprimées.

À l’ajout, une fiche technique doit fournir description, vigilance, critère de réussite, public et technique/famille ; le grade est également demandé en Judo. Elle ne nécessite pas un dosage d’exercice et ne crée pas de forme enfants automatique. Les exercices Judo conservent leurs contrôles pédagogiques et de dosage. Une fiche technique et un exercice peuvent partager un nom et une discipline sans fusionner leurs identifiants. La distinction suppose que le catalogue renseigne le type ; cette mise à jour ne prétend pas avoir audité ou converti le catalogue personnel.

Les séances restent dans « Mes séances » avec leur structure propre et ne sont pas acceptées comme type de fiche de catalogue. Validation : 74 tests passent, avec contrôle de la séparation des imports, des types dans le catalogue et de l’exclusion des références techniques des générations et routines. La vérification visuelle sur iPhone reste à effectuer.


## Modifier le classement depuis une fiche (17 novembre 2026)

Ouvrir une fiche puis « Modifier le classement » permet de changer son type, sa famille principale, sa sous-famille et ses tags. L’enregistrement crée ou actualise une correction locale du profil actif, sans recharger la page, changer l’identifiant ni toucher aux médias. Ces corrections sont incluses dans la sauvegarde complète et les exports existants. Vider la famille principale rétablit le recours à l’ancienne famille ou au classement de secours.

Le changement de type contrôle les champs nécessaires au nouveau type et refuse un doublon de même nom/type/discipline. Une fiche sélectionnée doit être retirée du brouillon avant de devenir une référence technique. Une référence ne devient pas un exercice sans dosage et, en Judo, sans les informations pédagogiques requises. L’éditeur de classement ne complète pas ces données à la place de l’éducateur.

Un échec de stockage n’applique pas les modifications. Le profil de destination est capturé avant l’écriture. Les médias du catalogue publié retrouvent la fiche par son identifiant même après un changement de type ; les nouvelles fiches sont rapprochées par nom, discipline et type. Les séances enregistrées restent conservées.

Validation : tests de conservation des identifiants/médias, d’échec de stockage, de séparation des profils, de validation du changement de type et de rattachement des médias publiés. La vérification visuelle sur Safari iPhone reste à effectuer.


## Imports de corrections fiabilisés (17 novembre 2026)

Un fichier contenant uniquement des corrections de fiches existantes atteint maintenant l’aperçu d’import : il n’est plus annoncé vide. L’aperçu liste les fiches à modifier, leur identifiant conservé et les principaux champs modifiés avec leurs valeurs avant/après (les textes longs sont abrégés dans cet aperçu). Rien n’est écrit avant confirmation.

Lorsqu’un fichier de correction omet famille principale, famille, sous-famille ou tags, ces données existantes sont conservées. Une colonne explicitement fournie vide permet de vider le champ correspondant. Les contrôles de complétude Judo restent applicables aux corrections ; cela ne transforme pas l’import en outil de modification partielle des prescriptions.

Les fiches, corrections et illustrations d’un lot sont enregistrées dans une seule transaction IndexedDB. Les images en mémoire ne changent qu’après confirmation de cette écriture. Une erreur conserve l’aperçu et réactive les commandes pour réessayer. Les confirmations multiples sont bloquées et une lecture de fichier dépassée par un nouveau choix ne remplace plus l’aperçu courant.

Les vidéos sont enregistrées séparément après ce lot : elles peuvent échouer individuellement, et leur nombre effectivement enregistré est annoncé. L’import entier, vidéos comprises, n’est donc pas une transaction unique. Si IndexedDB refuse la transaction des fiches/images, cette étape échoue sans chargement partiel ; elle n’utilise pas un secours local pour contourner cet échec.

Validation : 85 tests passent, dont fichier composé de corrections seules, conservation/effacement explicite du classement, transaction fiches/images, échec d’écriture et refus pédagogique. Validation visuelle et import sur Safari iPhone restant à effectuer.


## Format des fiches harmonisé (17 novembre 2026)

La description apparaît sous le nom. La fiche présente ensuite : point de sécurité, dosage de base, critère de réussite, famille, niveau, sous-groupe, matériel, muscles cibles, moment, variantes facile/difficile, accessibilité, inspiration et format. Seuls les champs renseignés apparaissent. Le grade Judo et les autres métadonnées restent accessibles dans « Informations complémentaires ». L’export HTML reprend l’ordre des rubriques et conserve la description et la source complète ; les exports JSON conservent leurs clés canoniques.

L’ajout reconnaît notamment les colonnes « Nom (exercice) », « Exécution », « Point de sécurité », « Dosage de base », « Critère de réussite », « Variante plus facile », « Variante plus difficile », « Accessibilité », « Inspiration » et « Technique ». Le validateur pédagogique et la lecture du dosage utilisent les alias déclarés par la normalisation. Les clés canoniques restent prioritaires et recommandées pour les fichiers JSON. Les colonnes pédagogiques supplémentaires du Judo restent nécessaires : les quinze rubriques de présentation ne les remplacent pas.

L’accessibilité est conservée à l’ajout et à la correction. L’inspiration n’est plus tronquée à la première virgule ; aucune source n’est inventée si le champ est absent. Une correction sans colonne Accessibilité/Inspiration conserve les valeurs existantes. Le niveau de difficulté Judo, lorsqu’il est déclaré, reste distinct du grade. L’organisation détaillée ne suffit pas à satisfaire le champ Format requis par la validation Judo.

Les anciens fichiers ne sont pas réécrits. La reconnaissance d’un intitulé ne garantit ni la pertinence pédagogique de sa valeur ni sa compatibilité avec tous les filtres. Validation : 90 tests passent, dont une fiche Judo complète à en-têtes français, la conservation des sources et de l’accessibilité, la séparation niveau/grade et l’ordre de présentation/export HTML. La vérification visuelle et tactile sur Safari iPhone reste à effectuer.


## Navigation clavier des fenêtres (17 novembre 2026)

Une vérification réelle dans Chrome a confirmé que Maj+Tab depuis « Ma séance » pouvait placer le focus sur le catalogue derrière la fenêtre. La tabulation est désormais contenue dans la dernière fenêtre explicitement modale et visible : le dernier contrôle rejoint le premier et inversement. Les contrôles masqués, désactivés ou inertes sont ignorés. Sans contrôle disponible, la fenêtre reçoit le focus. Les panneaux non modaux, dont la fiche latérale sur ordinateur, conservent leur navigation libre.

Le défilement de la page derrière une fenêtre modale est bloqué par CSS ; le contenu de la fenêtre reste défilable. Cette évolution ne constitue pas un audit complet d’accessibilité ni une vérification des lecteurs d’écran.

Contrôles de cette série : filtres Taïso par niveau et réinitialisation, ouverture d’une fiche publique, ajout au brouillon et ouverture de Ma séance dans Chrome. La session ne contenait que les dix fiches publiques ; le catalogue personnel et Safari iPhone n’ont pas été vérifiés. Les tests automatiques couvrent la tabulation aux limites, les fenêtres imbriquées et l’absence de fenêtre ou de contrôle : 94 tests passent.


## Cohérence des médias publics (17 novembre 2026)

Le parcours enregistrer une préparation, retrouver la séance et la lancer a été vérifié dans Chrome. La fiche publique « Assis-debout de la chaise » conservait une image et une vidéo montrant une chaise au mur sans chaise. Ces associations sont retirées ; l’exercice, son identifiant et ses consignes restent disponibles, avec un message explicatif. Les fichiers restent dans le dépôt pour permettre leur révision. Aucun média de remplacement n’a été inventé.

Le signalement empêche aussi une ancienne association publique de réapparaître dans la fiche, les exports et la préparation hors ligne. Les images et vidéos personnelles restent prioritaires et utilisables. Validation : 97 tests passent. Le catalogue personnel et Safari iPhone restent hors de cette vérification.


## Catalogue sans illustrations (17 novembre 2026)

À la demande du propriétaire, les illustrations sont suspendues pendant la consolidation de l’application : aucune image enregistrée ou schématique n’est affichée, les commandes d’ajout et de génération d’image sont retirées des fiches et les exports de fiches sont sans illustration. Les associations d’images du catalogue public sont retirées. Les vidéos restent distinctes de cette suspension.

Les données personnelles déjà stockées sur les appareils et les sauvegardes complètes ne sont pas effacées à distance. Les fichiers historiques du dépôt restent conservés. La future base n’est pas encore intégrée.


## Lisibilité du catalogue sans images (17 novembre 2026)

Les boutons d’ajout passent sous les cartes pour ne plus recouvrir les titres. Les noms s’affichent entièrement, y compris les noms longs. En mode liste, la colonne réservée aux anciennes vignettes est supprimée ; le bouton d’ajout dispose de sa propre colonne et les étiquettes reviennent à la ligne. Le filtre détaillé utilise aussi le terme « avec vidéo ». Aucun exercice ni dosage n’est modifié.

Validation : suite automatique de 97 tests. Les réglages tactiles sur Safari iPhone restent à vérifier.


## Enregistrement sans doublons (17 novembre 2026)

Enregistrer plusieurs fois la même préparation, ou exporter sa fiche PDF après l’enregistrement, ne crée plus une nouvelle entrée identique. La comparaison porte sur date, heure, cours, discipline, titre, exercices, paramètres et trame ; elle ignore l’identifiant généré et l’horodatage d’enregistrement. Une préparation modifiée ou datée d’un autre cours reste une nouvelle version. Les anciens doublons ne sont pas supprimés.

Validation : 100 tests, dont répétition d’enregistrement, ordre des champs, modification de dosage, autre date et échec de stockage. Aucun contrôle supplémentaire sur Safari iPhone dans cette série.

## Préparations par horaire (17 novembre 2026)

Dans « Cette semaine », le rattachement d’une séance prend désormais en compte l’heure du créneau. Deux cours du même groupe le même jour retrouvent chacun leur préparation ; une préparation à un autre horaire ne remplit plus un créneau encore vide. Les anciennes préparations sans heure restent proposées en secours, après recherche d’un horaire exact. Aucune séance enregistrée n’est modifiée.

Validation : 102 tests passent, dont deux horaires pour un même groupe, un créneau sans préparation, la priorité de l’horaire exact et la compatibilité des anciennes séances sans heure. La vérification visuelle sur Safari iPhone reste à effectuer.

## Suppression explicite des séances (17 novembre 2026)

Dans l’historique, la croix affiche « Confirmer la suppression » et « Conserver » avant toute écriture. Une écriture refusée conserve la séance et affiche une erreur avec possibilité de réessayer. Aucune ancienne séance n’est supprimée automatiquement.

Validation : 105 tests passent, dont demande de confirmation, conservation, suppression confirmée et échec de stockage. La vérification visuelle sur Safari iPhone reste à effectuer.

## Conservation du brouillon après une reprise refusée (17 novembre 2026)

Si la reprise d’une séance depuis le planning échoue lors de l’écriture de la sélection, les informations du brouillon et son rattachement au cours ne sont plus remplacés par ceux de la séance demandée. Le message d’échec reste visible. Une reprise réussie conserve le rattachement au créneau choisi.

Validation : 107 tests passent, dont reprise refusée avec conservation du groupe, du dosage et du rattachement, et reprise réussie depuis le planning. Safari iPhone reste à vérifier.

## Reprise et exercices absents du catalogue (17 novembre 2026)

Une reprise est refusée si un exercice de la séance enregistrée ne figure plus dans le catalogue actuel. Le message indique combien d’exercices sont absents ; le brouillon et l’historique sont conservés. Cela évite de préparer ou d’enregistrer silencieusement une version tronquée après un changement de catalogue. Les séances dont les exercices sont présents restent reprenables.

Validation : 108 tests passent, avec un cas mêlant exercice présent et exercice absent, et conservation des informations et du dosage du brouillon. La vérification Safari iPhone reste à effectuer.

## Créneau indisponible dans un brouillon (17 novembre 2026)

Si le créneau mémorisé ne figure plus dans les huit prochains jours proposés, « Pour quel cours ? » affiche explicitement cet ancien rattachement comme indisponible. L’enregistrement et l’export sont refusés tant que l’utilisateur n’a pas choisi un nouveau cours ou aujourd’hui sans créneau. Le brouillon reste disponible. Cette protection évite l’ancien repli silencieux sur la date du jour, y compris après suppression d’un créneau du planning.

Validation : 109 tests passent, dont refus d’enregistrement et d’export, puis enregistrement après choix explicite d’aujourd’hui. Safari iPhone reste à vérifier.

## Brouillons contenant des exercices introuvables (17 novembre 2026)

« Ma séance » indique le nombre d’exercices sélectionnés absents du catalogue. Le lancement, l’enregistrement et l’export ne peuvent plus ignorer silencieusement ces références. L’éducateur peut réimporter les fiches manquantes ou utiliser « Retirer les exercices introuvables » pour poursuivre avec les exercices disponibles. Ce retrait ne modifie pas les séances de l’historique ; un échec de stockage conserve la sélection. Une sélection entièrement introuvable peut également être vidée avec cette commande.

Validation : 112 tests passent, dont blocage du lancement/enregistrement/export d’une sélection partiellement introuvable, poursuite après retrait explicite, échec de stockage et sélection entièrement introuvable. La validation visuelle sur Safari iPhone reste à effectuer.

## Recherche dans l’historique (17 novembre 2026)

« Mes séances » permet de rechercher par titre, groupe ou date et de filtrer par Judo/Taïso. Les mots saisis peuvent être répartis entre titre et groupe ; accents et majuscules sont ignorés. Les dates ISO et jour/mois/année sont recherchables. Le nombre de résultats et un bouton d’effacement des filtres facilitent le retour à l’ensemble de l’historique. La pagination s’applique aux résultats et revient à trente à chaque changement de filtre. Les préparations de la semaine restent indépendantes de cette recherche.

Validation : 115 tests passent, avec recherche sans accents, dates, combinaison de filtres, effacement, état sans résultat et pagination. La validation visuelle et tactile sur Safari iPhone reste à effectuer.

## Remplacement explicite du brouillon (17 novembre 2026)

Préparer un autre cours ou reprendre une séance demande confirmation lorsqu’une préparation existe. Refuser conserve le brouillon. Une nouvelle préparation confirmée vide les anciens exercices et réglages ; l’écriture de la sélection doit réussir avant tout remplacement. Ouvrir de nouveau le même créneau conserve sa préparation. Les séances enregistrées restent inchangées.

Validation : 119 tests passent, dont refus de reprise, refus d’un nouveau cours, nouveau cours confirmé et échec de stockage. La validation Safari iPhone reste à effectuer.


## Séance du cours affiché sur l’accueil (17 novembre 2026)

La carte du cours du jour retrouve désormais la séance à partir de l’horaire du cours, comme la vue « Cette semaine ». Lorsque le même groupe a plusieurs séances prévues le même jour, la carte ne lance plus par erreur la séance d’un autre horaire. Les anciennes séances sans heure restent compatibles selon la règle de secours déjà utilisée dans « Mes séances ».


## Recherche étendue dans l’historique (17 novembre 2026)

La recherche de « Mes séances » examine également les noms des exercices, l’objectif et la thématique enregistrés dans la séance. Une séance peut ainsi être retrouvée à partir de son contenu, même si son titre est différent.


## Actualisation de la copie hors ligne (17 novembre 2026)

La version du cache du service worker est incrémentée avec la recherche étendue dans l’historique. Lorsqu’un appareil se reconnecte, le nouveau service worker précharge la page actuelle, s’active puis retire l’ancienne copie de l’application. La navigation en ligne conserve son chargement réseau prioritaire.
