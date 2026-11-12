# Voces de los diálogos — HOUSE OF ODDS

> Documento generado con `npm run dialogues` (no lo edites a mano: se regenera a partir de los datos del juego).

## Cómo poner las voces

1. Graba (o genera con IA) cada línea y guárdala como **`.mp3`** con el nombre exacto de la columna «Archivo».
2. Déjalas en `assets/audio/voice/`. Si quieres una voz distinta por idioma, usa subcarpetas:
   `assets/audio/voice/es/…`, `assets/audio/voice/en/…`, `de`, `fr`, `pt`, `zh`. El juego usa primero la del idioma
   activo y, si no existe, la general de `assets/audio/voice/`.
3. Ejecuta `npm run audio` (o arranca el servidor local) para actualizar el manifiesto. En Vercel se hace solo al desplegar.
4. Nombres en **minúsculas** (Vercel distingue mayúsculas). Una línea sin archivo simplemente se lee sin voz.

Al avanzar o saltar una línea, la voz que estaba sonando se corta y empieza la siguiente.
Las respuestas del jugador no llevan voz.

**Total: 103 líneas con voz** en 35 conversaciones.

## `m01_intro` · misión «Un nuevo comienzo»

| Archivo | Personaje | Texto (ES) | Text (EN) |
|---|---|---|---|
| `m01_intro__start.mp3` | Victoria Hawthorne | Ah, por fin. Pensaba que llegarías más tarde. | Ah, there you are. I was beginning to think you'd turn up later. |
| `m01_intro__v1.mp3` | Victoria Hawthorne | Victoria Hawthorne. Me encargo de administrar este lugar. Lo que queda de él, al menos. | Victoria Hawthorne. I run this place. What is left of it, anyway. |
| `m01_intro__v2.mp3` | Victoria Hawthorne | Y sí, como probablemente habrás notado, el casino necesita bastante más que una limpieza. | And yes, as you've surely noticed, this casino needs a great deal more than a good clean. |
| `m01_intro__v3.mp3` | Victoria Hawthorne | Durante años fue uno de los establecimientos más conocidos de la ciudad. Ahora apenas queda actividad. | For years it was one of the best-known houses in the city. Now there is barely any life left in it. |
| `m01_intro__v4.mp3` | Victoria Hawthorne | Ayudarme a devolverle la vida. | Help me bring it back to life. |
| `m01_intro__v5.mp3` | Victoria Hawthorne | Tenemos instalaciones que recuperar, máquinas que reparar y salas que llevan demasiado tiempo cerradas. Pero no podemos hacerlo todo de golpe. | We have rooms to reopen, machines to repair and halls that have been closed for far too long. But we can't do it all at once. |
| `m01_intro__v6.mp3` | Victoria Hawthorne | Antes de empezar, quiero que conozcas el lugar. El MAIN FLOOR es nuestro corazón: el mostrador de servicios, THE CLASSIC en su estrado, las mesas de cartas y la ruleta. | Before we start, I want you to know the place. The MAIN FLOOR is our heart: the services counter, THE CLASSIC on its stand, the card tables and the roulette. |
| `m01_intro__v7.mp3` | Victoria Hawthorne | Recórrelo. Cuando lo hayas visto todo, vuelve a verme aquí, junto a la recepción. | Walk the floor. When you've seen it all, come back to me here, by the reception. |

## `m01_report` · misión «Un nuevo comienzo»

| Archivo | Personaje | Texto (ES) | Text (EN) |
|---|---|---|---|
| `m01_report__start.mp3` | Victoria Hawthorne | ¿Y bien? ¿Qué te parece? | So? What do you make of it? |
| `m01_report__va.mp3` | Victoria Hawthorne | Bien. Es justo la respuesta que esperaba. | Good. That's the answer I was hoping for. |
| `m01_report__vb.mp3` | Victoria Hawthorne | Pregunta justa. Cada trabajo terminado se paga en MARKS, y los MARKS compran todo lo que este lugar necesita. Tú cobras; la casa recupera el pulso. | Fair question. Every job we finish pays in MARKS, and MARKS buy everything this place needs. You get paid; the house gets its pulse back. |
| `m01_report__vc.mp3` | Victoria Hawthorne | Mmm. Mirar ya es un comienzo. Pero no tardes demasiado en decidirte. | Hm. Looking is a start. Just don't take too long deciding. |
| `m01_report__v1.mp3` | Victoria Hawthorne | Lo primero es lo primero: THE CLASSIC. Es nuestra máquina más antigua y lleva meses sin funcionar. Daniel Reed, nuestro técnico, está en el banco de mantenimiento, junto a la pared este. | First things first: THE CLASSIC. It's our oldest machine and it hasn't worked in months. Daniel Reed, our technician, is at the maintenance bench by the east wall. |
| `m01_report__v2.mp3` | Victoria Hawthorne | Toma, cien MARKS por hoy. Considéralo un adelanto. | Here, a hundred MARKS for today. Consider it an advance. |

## `m02_intro` · misión «La primera máquina»

| Archivo | Personaje | Texto (ES) | Text (EN) |
|---|---|---|---|
| `m02_intro__start.mp3` | Daniel Reed | ¿Tú eres el nuevo? | You're the new one? |
| `m02_intro__db.mp3` | Daniel Reed | Daniel Reed. Al que todos llaman cuando algo deja de funcionar. Que, por aquí, es todo. | Daniel Reed. The one everybody calls when something stops working. Which, around here, is everything. |
| `m02_intro__d1.mp3` | Daniel Reed | Perfecto. Entonces supongo que vienes a ayudarme con este desastre. | Perfect. Then I guess you're here to help me with this disaster. |
| `m02_intro__d2.mp3` | Daniel Reed | Soy el técnico: reparaciones, instalación eléctrica, máquinas y cada pared nueva que tenga este sitio. Todo lo que haya que construir o arreglar pasa por mí, y cobro el trabajo en MARKS, como todos aquí. | I'm the technician: repairs, wiring, machines, and every new wall this place will ever get. Anything that needs building or fixing goes through me — and I charge for the work in MARKS, like everyone here. |
| `m02_intro__d3.mp3` | Daniel Reed | Pero primero, THE CLASSIC. Lleva aquí más tiempo que cualquiera de nosotros. El mecanismo está prácticamente intacto, pero necesita una revisión. | But first, THE CLASSIC. It's been here longer than any of us. The mechanism is practically intact; it just needs a proper check-up. |
| `m02_intro__d4.mp3` | Daniel Reed | Nos vemos en la máquina. Empieza por el panel lateral, el de la derecha. | I'll meet you at the machine. Start with the side panel — the right one. |

## `m02_panel` · misión «La primera máquina»

| Archivo | Personaje | Texto (ES) | Text (EN) |
|---|---|---|---|
| `m02_panel__start.mp3` | Daniel Reed | Bien. Contactos oxidados, pero nada que no se arregle con un poco de paciencia. | Good. Corroded contacts, but nothing a little patience can't fix. |
| `m02_panel__d2.mp3` | Daniel Reed | Ahora revisa el mecanismo de los rodillos. Para eso necesitarás mis herramientas: la caja roja de mi banco. Tráela. | Now the reel mechanism. For that you'll need my tools: the red toolbox on my bench. Bring it over. |

## `m02_mechanism` · misión «La primera máquina»

| Archivo | Personaje | Texto (ES) | Text (EN) |
|---|---|---|---|
| `m02_mechanism__start.mp3` | Daniel Reed | Ahí. Encájalo… y dale corriente. | There. Click it in… and power it up. |
| `m02_mechanism__d2.mp3` | Daniel Reed | Eso es. No está tan mal como pensaba. | That's it. She's not as bad as I thought. |
| `m02_mechanism__da.mp3` | Daniel Reed | ¿A que sí? El antiguo director decía que con ella se pagó la primera lámpara de araña de esta casa. Nunca supe si era verdad, pero me gusta creerlo. | Isn't she? The old director used to say she paid for the first chandelier of this house. I never knew if it was true, but I like to believe it. |
| `m02_mechanism__db1.mp3` | Daniel Reed | ¿Sustituirla? Ni hablar. | Replace her? Not a chance. |
| `m02_mechanism__db2.mp3` | Daniel Reed | Esta máquina forma parte de la historia del casino. Además, funciona perfectamente cuando recibe el mantenimiento adecuado. | This machine is part of the casino's history. And she works perfectly when she gets proper maintenance. |
| `m02_mechanism__dend.mp3` | Daniel Reed | Venga, hazle una tirada de demostración. Esta invita la casa. | Go on, give her a demonstration spin. This one's on the house. |

## `m02_outro` · misión «La primera máquina»

| Archivo | Personaje | Texto (ES) | Text (EN) |
|---|---|---|---|
| `m02_outro__start.mp3` | Daniel Reed | ¿Lo oyes? Esos rodillos no sonaban así desde hace años. | Hear that? Those reels haven't sounded like that in years. |
| `m02_outro__d2.mp3` | Daniel Reed | Buen trabajo. Victoria estará contenta. O al menos menos preocupada. | Good work. Victoria will be pleased. Or at least less worried. |
| `m02_outro__d3.mp3` | Daniel Reed | A partir de ahora, si quieres obras —luces, reparaciones, abrir salas nuevas—, ven a mi banco. Te diré el precio por adelantado. | From now on, if you want work done — lights, repairs, opening up new rooms — come to my bench. I'll give you the price up front. |
| `m02_outro__d4.mp3` | Daniel Reed | Y aquí tienes tu parte: ciento cincuenta MARKS. | And here is your share: one hundred and fifty MARKS. |

## `m03_intro` · misión «Abrimos las puertas»

| Archivo | Personaje | Texto (ES) | Text (EN) |
|---|---|---|---|
| `m03_intro__start.mp3` | Isabella Moreno | ¡Por fin! He visto que THE CLASSIC vuelve a funcionar. | Finally! I saw THE CLASSIC is working again. |
| `m03_intro__i2.mp3` | Isabella Moreno | Soy Isabella Moreno, de atención al cliente. Reputación, visitantes, eventos: ese es mi terreno. | I'm Isabella Moreno, guest relations. Reputation, visitors, events — that's my department. |
| `m03_intro__i3.mp3` | Isabella Moreno | Eso es exactamente lo que necesitábamos. Pero una máquina funcionando no convierte un edificio vacío en un casino. | That's exactly what we needed. But one working machine doesn't turn an empty building into a casino. |
| `m03_intro__i4.mp3` | Isabella Moreno | Tenemos que conseguir que el lugar vuelva a transmitir confianza. El plan: una buena limpieza, las luces principales encendidas, que Daniel arregle las goteras y las grietas, y un cartel de bienvenida en la puerta. | We have to make this place inspire confidence again. The plan: a proper clean, the main lights back on, Daniel fixing the leaks and the cracks, and a welcome sign at the door. |
| `m03_intro__i5.mp3` | Isabella Moreno | Victoria ha aprobado el presupuesto de esta noche, así que nada de esto sale de tu bolsillo. El equipo de limpieza espera en el mostrador de servicios, el cuadro eléctrico está en la pared norte, al lado… y la puerta todavía dice CERRADO, ¿verdad? | Victoria approved tonight’s budget, so none of this comes out of your pocket. The cleaning crew is waiting at the services counter, the main breaker is on the north wall next to it… and the door still says CLOSED, doesn’t it? |

## `m03_repair` · misión «Abrimos las puertas»

| Archivo | Personaje | Texto (ES) | Text (EN) |
|---|---|---|---|
| `m03_repair__start.mp3` | Daniel Reed | ¿Abrir ya? ¿Con agua cayendo del techo y el suelo partido? Ni hablar, jefe. | Open now? With water dripping from the ceiling and the floor split open? No way, boss. |
| `m03_repair__d2.mp3` | Daniel Reed | Si un cliente resbala en un charco, la primera noche será también la última. Déjame sellar las goteras, cambiar las losas rotas y tapar esas grietas. | If a customer slips in a puddle, our first night will also be our last. Let me seal the leaks, replace the broken slabs and patch up those cracks. |
| `m03_repair__da.mp3` | Daniel Reed | Sujeta la linterna y no toques nada. Es broma… casi. | Hold the torch and don't touch anything. Just kidding… mostly. |
| `m03_repair__db.mp3` | Daniel Reed | Rápido y bien no suelen ir juntos. Pero por ti haré una excepción. | Quick and good rarely go together. But for you, I'll make an exception. |
| `m03_repair__dend.mp3` | Daniel Reed | Dame un momento. Cuando termine, este edificio aguantará otros cincuenta años. | Give me a moment. When I'm done, this building will stand for another fifty years. |

## `m03_outro` · misión «Abrimos las puertas»

| Archivo | Personaje | Texto (ES) | Text (EN) |
|---|---|---|---|
| `m03_outro__start.mp3` | Isabella Moreno | Mira este sitio. Suelos limpios, luz de verdad… vuelve a parecer un casino. | Look at this place. Clean floors, real light… it feels like a casino again. |
| `m03_outro__i2.mp3` | Isabella Moreno | Podemos organizar una pequeña inauguración. Esta noche. ¿Cómo la quieres? | We can hold a small opening. Tonight. How do you want it? |
| `m03_outro__ia.mp3` | Isabella Moreno | Elegante, entonces. Una alfombra roja desde la puerta hasta THE CLASSIC. Lo clásico nunca falla. | Elegant it is. A red carpet from the door to THE CLASSIC. Classic never fails. |
| `m03_outro__ib.mp3` | Isabella Moreno | ¡Así se habla! Más luz, y me aseguraré de que toda la calle se entere. | Now you're talking! Brighter lights — and I'll make sure the whole street hears about it. |
| `m03_outro__ic.mp3` | Isabella Moreno | Práctico. Una apertura tranquila, y Daniel tendrá un par de tareas extra. Fingirá que se queja. | Practical. A quiet opening, then, and Daniel gets a few extra jobs. He’ll pretend to complain. |
| `m03_outro__iend.mp3` | Isabella Moreno | Pues decidido. Abrimos las puertas… ¡ya! | Then it's decided. Doors open… now! |

## `s01_offer` · misión «La historia de una máquina»

| Archivo | Personaje | Texto (ES) | Text (EN) |
|---|---|---|---|
| `s01_offer__start.mp3` | Daniel Reed | Hay algo que siempre me ha llamado la atención de esta máquina. | There's something that's always bugged me about THE CLASSIC. |
| `s01_offer__d2.mp3` | Daniel Reed | Es mucho más antigua de lo que parece. Si encontramos su manual original, podríamos descubrir quién la fabricó. | She's much older than she looks. If we found her original manual, we could find out who built her. |
| `s01_offer__da.mp3` | Daniel Reed | Así me gusta. Prueba en las cajas de la esquina noreste: años de papeles que nadie se ha atrevido a tirar. | That's the spirit. Try the boxes in the north-east corner — years of paperwork nobody dared to throw away. |
| `s01_offer__db.mp3` | Daniel Reed | Otro manual te dice cómo funciona. El original te dice quién fue. Mira en las cajas viejas de la esquina noreste. | Another manual tells you how she works. The original tells you who she was. Try the old boxes in the north-east corner. |

## `s01_deliver` · misión «La historia de una máquina»

| Archivo | Personaje | Texto (ES) | Text (EN) |
|---|---|---|---|
| `s01_deliver__start.mp3` | Daniel Reed | ¿Eso es…? ¡Lo es! ¡El manual original! | Is that…? It is. The original manual! |
| `s01_deliver__d2.mp3` | Daniel Reed | Mira este sello: «Hawthorne & Bennett Mechanical Works». Hawthorne… como Victoria. | Look at this stamp: «Hawthorne & Bennett Mechanical Works». Hawthorne… like Victoria. |
| `s01_deliver__d3.mp3` | Daniel Reed | Bueno. Esa es una pregunta para otro día. Gracias: le devolveré su acabado original. Ya verás. | Well. That's a question for another day. Thanks — I'll restore her original finish. You'll see. |

## `s02_offer` · misión «Una mejor primera impresión»

| Archivo | Personaje | Texto (ES) | Text (EN) |
|---|---|---|---|
| `s02_offer__start.mp3` | Isabella Moreno | Lo primero que ve un visitante es la recepción. Y ahora mismo la nuestra dice «nos hemos rendido». | The first thing a guest sees is the reception. And right now ours says «we gave up». |
| `s02_offer__i2.mp3` | Isabella Moreno | Quiero darle un aire nuevo. ¿Me ayudas a elegir? | I want to give it a new look. Will you help me choose? |
| `s02_offer__ia.mp3` | Isabella Moreno | ¡Genial! Echa primero un buen vistazo a la recepción y luego vuelve para decidirlo. | Wonderful! Have a good look at the reception first, then come back and we’ll decide. |
| `s02_offer__ib.mp3` | Isabella Moreno | Sin prisa. Estaré aquí mismo. | No rush. I’ll be right here. |

## `s02_choose` · misión «Una mejor primera impresión»

| Archivo | Personaje | Texto (ES) | Text (EN) |
|---|---|---|---|
| `s02_choose__start.mp3` | Isabella Moreno | Entonces, ¿qué tipo de bienvenida queremos dar? | So — what kind of welcome do we want to give? |
| `s02_choose__ia.mp3` | Isabella Moreno | Elegante. Atemporal. Me encanta. | Elegant. Timeless. I love it. |
| `s02_choose__ib.mp3` | Isabella Moreno | ¡Moderna! Un aire nuevo para un nuevo comienzo. | Modern! A fresh start for a fresh start. |
| `s02_choose__ic.mp3` | Isabella Moreno | Clásica. Un homenaje a lo que esta casa siempre fue. | Classic. Honouring what this house always was. |
| `s02_choose__iend.mp3` | Isabella Moreno | Las piezas están junto al mostrador. Colócalas y dime qué te parece. | The pieces are next to the desk. Set them up and tell me what you think. |

## `s02_confirm` · misión «Una mejor primera impresión»

| Archivo | Personaje | Texto (ES) | Text (EN) |
|---|---|---|---|
| `s02_confirm__start.mp3` | Isabella Moreno | Oh, qué bonito. Los visitantes lo notarán en cuanto entren. | Oh, that’s lovely. Guests will feel it the moment they walk in. |
| `s02_confirm__i2.mp3` | Isabella Moreno | Gracias. Doscientos MARKS de mi presupuesto de eventos, bien ganados. | Thank you. Two hundred MARKS from my events budget — well earned. |

## `x01_offer` · misión «El maestro clásico»

| Archivo | Personaje | Texto (ES) | Text (EN) |
|---|---|---|---|
| `x01_offer__start.mp3` | Daniel Reed | ¿Te apetece un desafío de verdad? THE CLASSIC esconde algo más que cerezas. | Fancy a real challenge? THE CLASSIC hides more than cherries. |
| `x01_offer__d2.mp3` | Daniel Reed | Diez rondas, un CLASSIC BONUS y una combinación especial. Si lo consigues, te llamaré MAESTRO CLÁSICO. | Ten rounds, a CLASSIC BONUS and one special combination. Pull that off and I’ll call you a CLASSIC MASTER. |
| `x01_offer__da.mp3` | Daniel Reed | ¡Ja! Cada día me caes mejor. Demuéstramelo. | Ha! I like you more every day. Show me. |
| `x01_offer__db.mp3` | Daniel Reed | La máquina no se va a ir a ninguna parte. Yo tampoco. | The machine isn’t going anywhere. Neither am I. |

## `x01_done` · misión «El maestro clásico»

| Archivo | Personaje | Texto (ES) | Text (EN) |
|---|---|---|---|
| `x01_done__start.mp3` | Daniel Reed | Diez rondas, un bonus y una buena combinación. Nada mal. | Ten rounds, a bonus and a proper combination. Not bad at all. |
| `x01_done__d2.mp3` | Daniel Reed | MAESTRO CLÁSICO. Te queda bien. Doscientos MARKS y mi respeto, que vale más. | CLASSIC MASTER. Suits you. Two hundred MARKS — and my respect, which is worth more. |

## `vic_tour` · charla repetible

| Archivo | Personaje | Texto (ES) | Text (EN) |
|---|---|---|---|
| `vic_tour__start.mp3` | Victoria Hawthorne | Tómate tu tiempo. El mostrador, THE CLASSIC, las cartas y la ruleta. Después vuelve conmigo. | Take your time. The counter, THE CLASSIC, the cards and the roulette — then come back to me. |

## `vic_daniel` · charla repetible

| Archivo | Personaje | Texto (ES) | Text (EN) |
|---|---|---|---|
| `vic_daniel__start.mp3` | Victoria Hawthorne | Daniel está en el banco de mantenimiento, junto a la pared este. Que su sarcasmo no te eche para atrás: es el mejor que tenemos. | Daniel is at the maintenance bench by the east wall. Don’t let the sarcasm put you off; he’s the best we have. |

## `vic_wait` · charla repetible

| Archivo | Personaje | Texto (ES) | Text (EN) |
|---|---|---|---|
| `vic_wait__start.mp3` | Victoria Hawthorne | THE CLASSIC tiene que demostrar lo que vale. Juega con ella un rato. | THE CLASSIC has to prove itself. Play it for a while. |
| `vic_wait__v2.mp3` | Victoria Hawthorne | Isabella tiene planes para este sitio, y querrá ver resultados primero. | Isabella has plans for this place, and she’ll want to see some results first. |

## `vic_m03` · charla repetible

| Archivo | Personaje | Texto (ES) | Text (EN) |
|---|---|---|---|
| `vic_m03__start.mp3` | Victoria Hawthorne | Isabella dirige la reapertura. Sigue sus indicaciones: con los clientes, me fío de su criterio. | Isabella is running the reopening. Follow her lead — I trust her judgement with guests. |

## `vic_after` · charla repetible

| Archivo | Personaje | Texto (ES) | Text (EN) |
|---|---|---|---|
| `vic_after__warm.mp3` | Victoria Hawthorne | Nada mal para una primera noche. Hiciste bien en comprometerte. | Not bad for a first night. You were right to commit to this. |
| `vic_after__cold.mp3` | Victoria Hawthorne | Nada mal para una primera noche. A lo mejor acabas haciendo promesas, después de todo. | Not bad for a first night. Maybe you’ll end up making promises after all. |
| `vic_after__v2.mp3` | Victoria Hawthorne | Oliver quiere recuperar sus mesas de cartas. Cuando estén listas, irá a buscarte. | Oliver wants his card tables back. When they are ready, he’ll come and find you. |

## `dan_busy` · charla repetible

| Archivo | Personaje | Texto (ES) | Text (EN) |
|---|---|---|---|
| `dan_busy__start.mp3` | Daniel Reed | Si la visita de Victoria me incluye: hola. Ahora déjame trabajar. | If Victoria’s tour includes me: hi. Now let me work. |

## `dan_m02` · charla repetible

| Archivo | Personaje | Texto (ES) | Text (EN) |
|---|---|---|---|
| `dan_m02__start.mp3` | Daniel Reed | Panel, herramientas, mecanismo. Paso a paso y volverá a ronronear. | Panel, tools, mechanism. One thing at a time and she’ll be purring again. |

## `dan_service` · charla repetible

| Archivo | Personaje | Texto (ES) | Text (EN) |
|---|---|---|---|
| `dan_service__start.mp3` | Daniel Reed | ¿Necesitas construir o arreglar algo? Dime qué quieres y te lo presupuesto en MARKS. | Need something built or fixed? Tell me what you want and I’ll quote you in MARKS. |
| `dan_service__shop.mp3` | Daniel Reed | Aquí tienes mi lista. Los precios incluyen materiales y mi encantadora compañía. | Here’s my list. Prices include materials and my charming company. |
| `dan_service__bye.mp3` | Daniel Reed | Ya sabes dónde encontrarme. | You know where to find me. |

## `isa_hello` · charla repetible

| Archivo | Personaje | Texto (ES) | Text (EN) |
|---|---|---|---|
| `isa_hello__start.mp3` | Isabella Moreno | ¡Bienvenido! Soy Isabella, de atención al cliente. | Welcome! I’m Isabella, guest relations. |
| `isa_hello__i2.mp3` | Isabella Moreno | Cuando THE CLASSIC lleve un rato funcionando, ven a verme. Tengo planes. | When THE CLASSIC has been running for a while, come and see me. I have plans. |

## `isa_m03` · charla repetible

| Archivo | Personaje | Texto (ES) | Text (EN) |
|---|---|---|---|
| `isa_m03__start.mp3` | Isabella Moreno | El equipo del mostrador, el cuadro eléctrico de la pared norte, Daniel con las goteras y el cartel de la puerta. ¡Uno a uno! | The crew at the counter, the breaker on the north wall, Daniel and the leaks, and the sign at the door. One by one! |

## `isa_after` · charla repetible

| Archivo | Personaje | Texto (ES) | Text (EN) |
|---|---|---|---|
| `isa_after__start.mp3` | Isabella Moreno | ¿Los has oído? ¡Clientes de verdad! Asegurémonos de que vuelvan. | Did you hear them? Real guests! Let’s make sure they keep coming back. |

## `eth_closed` · charla repetible

| Archivo | Personaje | Texto (ES) | Text (EN) |
|---|---|---|---|
| `eth_closed__start.mp3` | Ethan Parker | Ethan Parker, seguridad. | Ethan Parker, security. |
| `eth_closed__e2.mp3` | Ethan Parker | Las puertas siguen cerradas hasta que Victoria diga lo contrario. Hasta entonces, solo estamos nosotros y el polvo. | The doors stay closed until Victoria says otherwise. Until then, it’s just us and the dust. |

## `eth_open` · charla repetible

| Archivo | Personaje | Texto (ES) | Text (EN) |
|---|---|---|---|
| `eth_open__start.mp3` | Ethan Parker | Más gente esta noche. Me gusta cuando hay movimiento: se lee mejor que el vacío. | More people tonight. I like it busy — busy is easier to read than empty. |

## `oli_wait` · charla repetible

| Archivo | Personaje | Texto (ES) | Text (EN) |
|---|---|---|---|
| `oli_wait__start.mp3` | Oliver Grant | Buenas tardes. Oliver Grant, cartas. | Good evening. Oliver Grant, cards. |
| `oli_wait__o2.mp3` | Oliver Grant | Las mesas están preparadas. Los jugadores, todavía no. | The tables are ready. The players aren’t. Yet. |

## `oli_soon` · charla repetible

| Archivo | Personaje | Texto (ES) | Text (EN) |
|---|---|---|---|
| `oli_soon__start.mp3` | Oliver Grant | Victoria me dice que las puertas están abiertas. Pronto te pediré ayuda con las mesas: las cartas ya han esperado bastante. | Victoria tells me the doors are open. Soon I’ll ask for your help with the tables — the cards have waited long enough. |

## `luc_wait` · charla repetible

| Archivo | Personaje | Texto (ES) | Text (EN) |
|---|---|---|---|
| `luc_wait__start.mp3` | Lucas Moretti | ¡Lucas Moretti, a tu servicio! La ruleta y yo somos viejos amigos. | Lucas Moretti, at your service! The wheel and I are old friends. |
| `luc_wait__l2.mp3` | Lucas Moretti | Ahora descansa… de momento. Toda gran artista necesita un intermedio. | She’s resting… for now. Every great performer needs an intermission. |

## `luc_soon` · charla repetible

| Archivo | Personaje | Texto (ES) | Text (EN) |
|---|---|---|---|
| `luc_soon__start.mp3` | Lucas Moretti | ¿Oyes al público? La ruleta también lo nota. Paciencia, amigo mío: su momento está llegando. | Hear that crowd? The wheel can feel it too. Patience, my friend — her moment is coming. |

## `sof_dirty` · charla repetible

| Archivo | Personaje | Texto (ES) | Text (EN) |
|---|---|---|---|
| `sof_dirty__start.mp3` | Sofia Martínez | Sofia Martínez, diseño de interiores. Este lugar tiene una estructura preciosa. | Sofia Martínez, interior design. This place has bones — beautiful bones. |
| `sof_dirty__s2.mp3` | Sofia Martínez | Solo le falta… todo. Cuando esté limpio, ven a hablarme de gusto. | It just needs… everything. Once it’s clean, come and talk to me about taste. |

## `sof_service` · charla repetible

| Archivo | Personaje | Texto (ES) | Text (EN) |
|---|---|---|---|
| `sof_service__start.mp3` | Sofia Martínez | Alfombras, estatuas, lámparas de araña. Dime con qué sueñas y te diré cuánto cuesta en MARKS. | Carpets, statues, chandeliers. Tell me what you dream of and I’ll tell you what it costs in MARKS. |
| `sof_service__shop.mp3` | Sofia Martínez | Cada pieza, colocada con intención. Aquí nada decora por decorar. | Every piece placed with intention. Nothing here is decoration for decoration’s sake. |
| `sof_service__bye.mp3` | Sofia Martínez | La inspiración no espera eternamente, ¿sabes? | Inspiration doesn’t wait forever, you know. |
