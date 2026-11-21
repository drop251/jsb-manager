# JSB Manager — traitement documenté des 27 exclusions V46

## Périmètre vérifié

Source : onglet `02_Gates_27` du classeur `JSB_Taiso_V46_Controle_Normalisation_244_NON_IMPORT.xlsx`, lu via l'index textuel du projet (21/11/2026).

**27 lignes présentes.** Distribution des traitements : **20 CORRECTION**, **4 FUSION**, **1 NOUVELLE FICHE**, **1 SUSPENDU**, **1 PATCH EXISTANT**.

Toutes les colonnes d'essai terrain et d'accord staff étaient **NON TESTÉ** dans la source consultée. Aucun changement de statut ne peut être effectué uniquement sur la base de la correspondance documentaire du lot de 20.

## Références hors lot des 20 corrections

| Référence historique | Exercice historique | Traitement dans l'onglet de validation | Décision indiquée |
|---|---|---|---|
| JSB-TAISO-RENF-0096 | Pompe explosive mains sur banc | FUSION | NE PAS IMPORTER |
| JSB-TAISO-RENF-0141 | Poussée frontale avec élastique sous les pieds | FUSION | NE PAS IMPORTER |
| JSB-TAISO-RENF-0203 | Presse isométrique des pieds contre une sangle assis | NOUVELLE FICHE | BLOQUÉ |
| JSB-TAISO-RENF-0211 | Montée du genou assis contre minibande légère | FUSION | NE PAS IMPORTER |
| JSB-TAISO-RENF-0223 | Extension de coude assise avec élastique sous le pied | FUSION | NE PAS IMPORTER |
| JSB-TAISO-RENF-0236 | Pression des avant-bras sur table avec tronc fixé | SUSPENDU | ARBITRAGE REQUIS |
| JSB-TAISO-RENF-0244 | Extension isométrique de hanche contre coussin au mur | PATCH EXISTANT | BLOQUÉ |

Les 20 fiches classées CORRECTION et leurs identifiants historiques sont répertoriées dans `rapport-reel-taiso-v46-20.md`.

## Décisions de gestion des données

1. **CORRECTION :** préserver le nom et l'ID de la fiche existante uniquement après rapprochement avec le profil local et validation de l'aperçu d'import.
2. **FUSION :** conserver la fiche historique en quarantaine, ne pas recréer la même fonction comme exercice supplémentaire.
3. **NOUVELLE FICHE (0203) :** aucun nouvel ID ni publication avant validation technique, pédagogique et contrôle de doublon.
4. **SUSPENDU (0236) :** arbitrer la fonction biomécanique avant classement. Ne pas forcer dans une famille inadaptée.
5. **PATCH EXISTANT (0244) :** modification ciblée de la fiche de destination, sans création systématique ni suppression de l'original.

## Gate de publication

L'analyse du texte indexé confirme une **cohérence documentaire** sur les 20 corrections, mais ne constitue ni un essai terrain, ni une validation médicale, ni une preuve de compatibilité d'import `.xlsx`. Le fichier de contrôle de 244 candidats reste **NON IMPORTABLE** et ne doit pas être chargé dans l'application.

**Décision globale : NO GO IMPORT** avant preuves et essais sur appareil de test.
