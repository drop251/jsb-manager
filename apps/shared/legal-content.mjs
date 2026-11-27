// Working texts for the private V36 preview only. Not a commercial publication.
// The editor's verified identity, contact and operational retention policy
// must be completed and approved before publication.
export const LEGAL_TEMPLATES=Object.freeze({
 cgu:{title:'Conditions générales d’utilisation',body:`JSB Manager et JSB Admin — projet V1 — préproduction privée, 27 novembre 2026

1. Objet et périmètre
JSB Manager est un outil d'aide à la préparation des séances de Judo et Taïso, au suivi personnel et, pour les comptes Coach, à la gestion des groupes, des créneaux et des présences. JSB Admin est l'espace distinct de maintenance et de contrôle de la plateforme. L'état de chaque module est indiqué dans l'application. Aucun abonnement ni paiement n'est proposé dans cette préproduction.

2. Accès et comptes
La préproduction est réservée aux testeurs adultes autorisés. Les comptes Coach, Particulier et Administrateur disposent de droits distincts. L'accès Admin exige une double authentification. Chaque testeur protège ses identifiants, ses codes et ses phrases secrètes locales, et signale tout accès suspect au responsable du projet par le canal d'invitation. Il ne communique pas ses accès à un tiers.

3. Utilisation autorisée
Les tests utilisent exclusivement des données fictives de pratiquants et des exercices de recette ou des contenus dont l'utilisation est autorisée. Il est interdit de saisir des informations réelles de licenciés, y compris de mineurs, de contourner les autorisations ou de perturber le service. Les comptes de test utilisent une adresse contrôlée par le testeur. Le Coach ne peut consulter que son registre privé ; cette version ne propose pas de registre partagé entre plusieurs Coachs.

4. Responsabilité pédagogique et sécurité
Les propositions d'exercices et de séances ne constituent ni un avis médical ni une garantie de résultat sportif. L'encadrant apprécie les prérequis, l'âge, le niveau, les restrictions, la sécurité, l'organisation, la charge et les récupérations avant usage. Une proposition ou une copie locale peut être incomplète ou obsolète. La validation pédagogique reste distincte de la génération. Ces règles n'excluent pas les responsabilités légales de l'éditeur et ne limitent pas les droits impératifs de l'utilisateur.

5. Disponibilité et hors connexion
Les fonctionnalités peuvent être indisponibles pendant les opérations de recette et de maintenance. Les coffres locaux sont protégés par une phrase secrète distincte du mot de passe du compte. L'accès hors ligne ne confirme ni la validité actuelle de la session ni celle du catalogue. Les copies locales peuvent disparaître si les données du navigateur sont effacées. Le testeur vérifie la confirmation serveur avant de supprimer une copie locale. Les conflits de présences nécessitent une décision explicite lorsque des modifications sont contradictoires. Aucune sauvegarde de production n'est garantie dans cette préproduction.

6. Contenus et droits
Les contenus et signes distinctifs restent soumis aux droits de leurs titulaires. Les testeurs ne déposent que des contenus qu'ils sont autorisés à utiliser. Aucun droit sur les contenus tiers, notamment ceux de fédérations ou d'autres éditeurs, n'est transféré par l'accès à JSB. Les données saisies ne deviennent pas la propriété de la plateforme.

7. Fin du test et évolutions
Le testeur peut cesser d'utiliser l'application et demander la clôture de son compte au responsable du projet. Les conditions et modalités de conservation sont décrites dans la politique de confidentialité. L'accès peut être suspendu pour un motif de sécurité ou de non-respect des règles du test, de manière proportionnée. Une nouvelle version de conditions sera présentée avant toute acceptation requise. L'accès commercial, les tarifs, les CGV et les garanties correspondantes font l'objet de documents distincts.

8. Réclamations et statut juridique
Les demandes relatives au test peuvent être adressées au responsable via le canal d'invitation. Les droits légaux et les voies de recours applicables demeurent réservés. Le présent projet ne fixe pas de compétence juridictionnelle exclusive et ne vaut pas contrat de vente.

À compléter avant publication : identité juridique vérifiée de l'éditeur, adresse professionnelle et coordonnées de contact, mentions légales et validation des modalités définitives du service.`},
 privacy:{title:'Politique de confidentialité',body:`JSB Manager et JSB Admin — projet V1 — préproduction privée, 27 novembre 2026

1. Responsable et périmètre
Le responsable du projet organise les traitements liés aux comptes, à la sécurité et à la fourniture du service de test. Son identité juridique et un contact permanent pour l'exercice des droits doivent être renseignés avant publication. Pendant la recette privée, les testeurs utilisent leur canal d'invitation pour toute demande. Les documents ne sont pas encore publiés comme politique définitive.

2. Données traitées et finalités
Comptes : adresse électronique contrôlée par le testeur, identifiant interne, rôle, état de vérification, empreinte du mot de passe et informations techniques de session. Finalités : inscription, accès, vérification, récupération et sécurité du compte. Pour Admin, le secret MFA est protégé côté serveur.
Sécurité : informations nécessaires à la limitation des tentatives, journaux techniques et métadonnées de requêtes éventuellement traitées par l'hébergeur. Finalités : prévention des abus, diagnostic et maintien de l'intégrité.
Séances : réglages, brouillons, exercices sélectionnés et validations effectuées par le compte. Finalité : préparation et reprise du travail.
Présences : noms fictifs, groupes, état actif/archivé, créneaux, dates et statuts de présence fictifs. Finalité : recette du registre et de la synchronisation. Ne saisir aucune donnée réelle de licencié, de mineur, de santé, de handicap, de certificat médical ou de motif d'absence.
Préférences et stockage local : thème, taille du texte, contraste, animations et copies hors ligne choisies par le testeur. Finalité : fonctionnement de l'interface et reprise sans réseau.
Documents juridiques : lors d'une publication effective, identifiant du compte, type, version, empreinte du texte, nature de l'acte et date d'enregistrement. Finalité : preuve de l'acceptation des CGU ou de la prise de connaissance de la politique. La prise de connaissance ne constitue pas un consentement global au traitement.

3. Bases juridiques envisagées
L'exécution du service ou des mesures précontractuelles sollicitées peut justifier les opérations strictement nécessaires au compte et aux fonctionnalités demandées. La sécurité et la prévention des abus peuvent relever de l'intérêt légitime, après analyse de nécessité et de proportionnalité. La conservation d'une preuve peut relever de la défense des droits ou d'une obligation légale identifiée. Ces bases et leurs durées doivent être confirmées dans le registre des traitements avant l'ouverture publique. Aucun traitement publicitaire n'est prévu dans cette version.

4. Destinataires et hébergement
Les données nécessaires sont accessibles aux personnes autorisées et aux prestataires agissant selon leur rôle. La préproduction utilise Render et une base PostgreSQL dédiée, déployées dans la région de Francfort. L'accès Admin n'autorise pas par lui-même la lecture des registres privés Coach. Les opérations de support autorisées doivent être limitées et tracées. Le prestataire de messagerie ne sera utilisé pour les envois réels qu'après configuration. Les conditions contractuelles de sous-traitance, la liste des destinataires et les éventuels transferts hors EEE, avec leurs garanties, doivent être vérifiés avant publication ; une région d'hébergement européenne ne suffit pas à exclure de tels transferts.

5. Durées de conservation et effacement
Le cookie d'accès privé est valable huit heures ; les codes de vérification et de récupération ont des durées de validité limitées. L'expiration d'un jeton n'est pas équivalente à son effacement en base. Les comptes, registres de test, journaux, sauvegardes éventuelles et preuves juridiques doivent faire l'objet d'une durée documentée et d'une procédure de purge ou d'anonymisation. Ces durées et leur exécution ne sont pas encore validées en préproduction. Les données locales restent sur l'appareil jusqu'à effacement du coffre ou des données du site. L'effacement local ne supprime pas automatiquement les données serveur.

6. Stockage local et sécurité
Les cookies de session et d'accès privé servent à l'authentification et à la protection du service. Les préférences d'affichage sont enregistrées localement. Les coffres Taïso et Présences utilisent un chiffrement local AES-GCM et une clé dérivée de la phrase secrète. Les éléments statiques nécessaires à la lecture hors réseau peuvent être mis en cache ; les API et les données de compte ne doivent pas y être conservées. Le verrouillage et la synchronisation ne dispensent pas de protéger l'appareil. Les cookies et stockages strictement nécessaires sont distincts des traceurs soumis au consentement. Aucun traceur publicitaire n'est prévu.

7. Droits des personnes
Selon les conditions prévues par le RGPD, les personnes concernées disposent notamment des droits d'accès, rectification, effacement, limitation, opposition et portabilité. Lorsque le traitement repose sur un consentement, celui-ci peut être retiré. Une demande peut être déposée depuis Mes données personnelles dans les réglages du compte, ou transmise au responsable du projet par le canal d'invitation pendant la recette, y compris sans compte actif. La demande en ligne enregistre son type, sa référence, sa date et son état de traitement ; elle ne déclenche pas automatiquement un effacement. Aucun justificatif ni donnée de licencié ne doit être transmis dans cet écran. Un export JSON individuel des données serveur du compte peut être préparé après confirmation du mot de passe ; il exclut les données de licenciés, les coffres locaux et les journaux externes. Le droit d’accès complet reste exerçable par une demande distincte. Le contact définitif doit être publié. Il est également possible de saisir la CNIL (www.cnil.fr) ou l'autorité de contrôle compétente. Une vérification proportionnée de l'identité peut être nécessaire. Le droit à l'effacement n'est pas absolu et les exceptions doivent être justifiées.

8. Utilisation future par un club
L'organisme qui détermine les finalités et les moyens du traitement des données de ses licenciés en assume les obligations de responsable de traitement. Si JSB agit sur ses instructions, un contrat conforme à l'article 28 du RGPD est nécessaire. Les rôles, les accès, l'information des pratiquants et de leurs représentants, la minimisation, les durées, les transferts et les procédures d'incident doivent être définis avant toute utilisation réelle. Ce projet n'autorise pas l'import de données personnelles de licenciés.

9. Évolutions
La version publiée et sa date d'effet seront consultables. Une prise de connaissance distincte des CGU sera proposée lorsque nécessaire. Aucune acceptation de ce projet de texte n'est enregistrée.

À compléter avant publication : identité et coordonnées du responsable, bases légales définitivement retenues, durées et mécanismes de suppression, contact droits, sous-traitants et transferts vérifiés, contrat de sous-traitance clubs.`},
 cgv:{title:'Conditions générales de vente',body:'Non applicables à la préproduction privée : aucun paiement, tarif, abonnement ou contrat de vente n’est activé. Les CGV devront être rédigées en fonction de l’offre réelle, du statut du professionnel et des règles applicables aux consommateurs et professionnels.'}
});
