"use client";

import { useEffect, useState } from "react";
import {
  BookOpen,
  Rocket,
  LayoutGrid,
  Columns3,
  ListTodo,
  Flag,
  CalendarClock,
  Repeat,
  Tag,
  Users,
  CheckCheck,
  Share2,
  MessageSquare,
  Paperclip,
  Clock,
  Filter,
  CalendarDays,
  BarChart2,
  LayoutDashboard,
  Bell,
  MessageCircle,
  Command,
  Shield,
  LayoutTemplate,
  Smartphone,
  Keyboard,
  Lock,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/cn";

type Sec = { id: string; label: string; icon: React.ElementType };

const SECTIONS: { group: string; items: Sec[] }[] = [
  {
    group: "Начало",
    items: [
      { id: "intro", label: "Что такое Projectra", icon: BookOpen },
      { id: "start", label: "Быстрый старт", icon: Rocket },
    ],
  },
  {
    group: "Доски и задачи",
    items: [
      { id: "boards", label: "Доски", icon: LayoutGrid },
      { id: "columns", label: "Колонки и статусы", icon: Columns3 },
      { id: "tasks", label: "Задачи и карточка", icon: ListTodo },
      { id: "priority", label: "Приоритет и цвет", icon: Flag },
      { id: "dates", label: "Сроки и напоминания", icon: CalendarClock },
      { id: "recurrence", label: "Повторение", icon: Repeat },
      { id: "assignees", label: "Исполнители и подтверждение", icon: Users },
      { id: "subtasks", label: "Подзадачи", icon: CheckCheck },
      { id: "labels", label: "Метки", icon: Tag },
      { id: "links", label: "Связи задач", icon: Share2 },
      { id: "comments", label: "Комментарии и упоминания", icon: MessageSquare },
      { id: "files", label: "Файлы", icon: Paperclip },
      { id: "time", label: "Учёт времени", icon: Clock },
      { id: "views", label: "Виды и фильтры", icon: Filter },
    ],
  },
  {
    group: "Обзор работы",
    items: [
      { id: "dashboard", label: "Дашборд", icon: LayoutDashboard },
      { id: "calendar", label: "Календарь", icon: CalendarDays },
      { id: "workload", label: "Нагрузка", icon: BarChart2 },
      { id: "inbox", label: "Входящие", icon: Bell },
      { id: "messages", label: "Сообщения", icon: MessageCircle },
      { id: "search", label: "Поиск и ⌘K", icon: Command },
    ],
  },
  {
    group: "Доступ и администрирование",
    items: [
      { id: "permissions", label: "Права доступа", icon: Shield },
      { id: "templates", label: "Шаблоны", icon: LayoutTemplate },
      { id: "mobile", label: "Мобильное и PWA", icon: Smartphone },
      { id: "hotkeys", label: "Горячие клавиши", icon: Keyboard },
    ],
  },
];

const FLAT = SECTIONS.flatMap((g) => g.items);

export function DocsView() {
  const [active, setActive] = useState(FLAT[0].id);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-15% 0px -75% 0px", threshold: 0 },
    );
    for (const s of FLAT) {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, []);

  function go(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* Sticky TOC */}
      <aside className="sticky top-6 hidden h-[calc(100dvh-6rem)] w-60 shrink-0 overflow-y-auto lg:block">
        <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
          Содержание
        </p>
        <nav className="space-y-4">
          {SECTIONS.map((grp) => (
            <div key={grp.group} className="space-y-0.5">
              <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-700">
                {grp.group}
              </p>
              {grp.items.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => go(id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm transition",
                    active === id
                      ? "bg-white/10 text-neutral-100"
                      : "text-neutral-400 hover:bg-white/5 hover:text-neutral-200",
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0 truncate">{label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <article className="min-w-0 flex-1 pb-24">
        <Hero />
        <Intro />
        <Content />
      </article>
    </div>
  );
}

// ── Building blocks ────────────────────────────────────────────────────────

function Hero() {
  return (
    <header className="mb-10">
      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-400">
        <BookOpen className="h-3.5 w-3.5 text-sky-400" />
        Документация
      </div>
      <h1 className="bg-gradient-to-r from-white via-neutral-200 to-neutral-500 bg-clip-text text-4xl font-black text-transparent sm:text-5xl">
        Как работать в Projectra
      </h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-neutral-400">
        Полное руководство: доски и задачи, сроки и повторения, исполнители,
        комментарии, календарь, права доступа и горячие клавиши. Всё, что нужно,
        чтобы команда работала, ничего не теряя.
      </p>
    </header>
  );
}

function Section({
  id,
  icon: Icon,
  title,
  color = "text-sky-400",
  children,
}: {
  id: string;
  icon: React.ElementType;
  title: string;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6 border-t border-white/5 py-10 first:border-0">
      <h2 className="mb-4 flex items-center gap-2.5 text-2xl font-bold text-neutral-100">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]">
          <Icon className={cn("h-5 w-5", color)} />
        </span>
        {title}
      </h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-neutral-300">
        {children}
      </div>
    </section>
  );
}

function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="my-3 space-y-2">{children}</ol>;
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-xs font-bold text-sky-300">
        {n}
      </span>
      <span className="pt-0.5">{children}</span>
    </li>
  );
}

function Bullets({ children }: { children: React.ReactNode }) {
  return <ul className="my-2 space-y-1.5">{children}</ul>;
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-600" />
      <span>{children}</span>
    </li>
  );
}

function Tip({
  children,
  tone = "sky",
}: {
  children: React.ReactNode;
  tone?: "sky" | "amber" | "violet";
}) {
  const tones = {
    sky: "border-sky-500/30 bg-sky-500/[0.07] text-sky-100",
    amber: "border-amber-500/30 bg-amber-500/[0.07] text-amber-100",
    violet: "border-violet-500/30 bg-violet-500/[0.07] text-violet-100",
  };
  return (
    <div className={cn("my-3 rounded-xl border px-4 py-3 text-sm", tones[tone])}>
      {children}
    </div>
  );
}

function B({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-neutral-100">{children}</strong>;
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-md border border-white/15 bg-white/[0.06] px-1.5 py-0.5 text-[12px] font-medium text-neutral-200">
      {children}
    </kbd>
  );
}

// ── Intro + all sections ───────────────────────────────────────────────────

function Intro() {
  return (
    <Section id="intro" icon={BookOpen} title="Что такое Projectra">
      <p>
        <B>Projectra</B> — командный таск-менеджер. Работа строится вокруг{" "}
        <B>досок</B>: каждая доска — это набор колонок, по которым вы двигаете{" "}
        <B>задачи</B> слева направо по мере выполнения. К задачам можно назначать
        исполнителей, ставить сроки, метки, приоритет, прикреплять файлы, вести
        обсуждение и учитывать время.
      </p>
      <p>
        Помимо досок есть единый <B>календарь</B> со всеми сроками, страница{" "}
        <B>нагрузки</B> по людям, <B>мессенджер</B>, <B>уведомления</B> и
        гибкая система <B>прав доступа</B>.
      </p>
      <Tip>
        Если чего-то не видно в меню — скорее всего, у вашей роли нет на это прав.
        Это нормально: интерфейс скрывает недоступное, а не показывает «запрещено».
      </Tip>
    </Section>
  );
}

function Content() {
  return (
    <>
      <Section id="start" icon={Rocket} title="Быстрый старт" color="text-emerald-400">
        <Steps>
          <Step n={1}>
            Откройте <B>Доски</B> в меню слева и создайте доску — или возьмите
            готовый <B>шаблон</B> (Стандарт, Баг-трекер, Найм, Личные задачи).
          </Step>
          <Step n={2}>
            Добавьте задачу кнопкой <B>«+ Добавить задачу»</B> внизу колонки.
            Введите название и нажмите <Kbd>Enter</Kbd>.
          </Step>
          <Step n={3}>
            Кликните по карточке, чтобы открыть её и заполнить: исполнители,
            срок, приоритет, описание.
          </Step>
          <Step n={4}>
            Перетаскивайте карточку в следующую колонку по мере работы. Колонка
            задаёт <B>статус</B> задачи автоматически.
          </Step>
          <Step n={5}>
            Готовую задачу перенесите в <B>«Завершённые задачи»</B> — она уйдёт в
            архив доски.
          </Step>
        </Steps>
      </Section>

      <Section id="boards" icon={LayoutGrid} title="Доски">
        <p>
          Доска — главное рабочее пространство. Бывает двух видов:
        </p>
        <Bullets>
          <Li>
            <B>Общая</B> — доступна команде по правам доступа; участники и роли
            настраиваются.
          </Li>
          <Li>
            <B>Личная</B> <Lock className="inline h-3.5 w-3.5 -translate-y-0.5" />{" "}
            — видна только владельцу и тем, кого он явно добавил.
          </Li>
        </Bullets>
        <p>
          В шапке доски: переключатель <B>видов</B>, кнопки <B>Связи</B>,{" "}
          <B>Экспорт</B>, <B>Участники</B>, а также карандаш (переименовать) и
          корзина (удалить) — если у вас есть права.
        </p>
        <Tip tone="violet">
          Кнопка <B>«Участники»</B> на общей доске позволяет выдать конкретным
          людям роль <B>Владелец / Редактор / Комментатор / Наблюдатель</B> именно
          на этой доске — поверх глобальных прав.
        </Tip>
      </Section>

      <Section id="columns" icon={Columns3} title="Колонки и статусы">
        <p>
          Колонки — это этапы. Добавляйте их кнопкой <B>«+ Колонка»</B>,
          переименовывайте и перетаскивайте за заголовок, меняя порядок.
        </p>
        <p>
          У каждой колонки есть <B>статус</B> (точка-индикатор в заголовке):{" "}
          <B>Бэклог</B>, <B>К выполнению</B>, <B>В работе</B>, <B>Готово</B>.
          Когда задача попадает в колонку, она <B>наследует её статус</B> — поэтому
          в карточке статус не редактируется вручную, а «Определяется колонкой».
          Сменить статус колонки можно в её меню <B>«⋯ → Статус колонки»</B>.
        </p>
        <Tip tone="amber">
          Колонка <B>«Завершённые задачи»</B> — системная и неудаляемая. Перенести
          задачу туда может только <B>постановщик</B> (или администратор), и только
          когда <B>все исполнители подтвердили</B> выполнение.
        </Tip>
      </Section>

      <Section id="tasks" icon={ListTodo} title="Задачи и карточка">
        <p>
          Клик по карточке открывает окно задачи. Под названием — ряд{" "}
          <B>чипсов-сводки</B> (статус, приоритет, срок, повторение, исполнители,
          подзадачи, метки), чтобы всё было видно сразу. Ниже — редактируемые
          секции:
        </p>
        <Bullets>
          <Li><B>Описание</B> — поддерживает переносы строк и @-упоминания.</Li>
          <Li><B>Файлы</B> — вложения к задаче.</Li>
          <Li><B>Срочность</B>, <B>Сроки</B>, <B>Исполнители</B>, <B>Метки</B>, <B>Повторение</B>, <B>Цвет</B>.</Li>
          <Li><B>Подзадачи</B>, <B>Учёт времени</B>, <B>История</B> изменений, <B>Связи</B> и <B>Комментарии</B>.</Li>
        </Bullets>
        <p>
          Изменения сохраняются по кнопке сохранения формы; остальные действия
          (исполнители, подзадачи, файлы, время) применяются сразу.
        </p>
      </Section>

      <Section id="priority" icon={Flag} title="Приоритет и цвет" color="text-amber-400">
        <p>
          <B>Приоритет</B> (Низкая / Средняя / Высокая / Срочная) подсвечивает
          карточку и помогает сортировать внимание. <B>Цвет</B> задаёт полоску
          сверху карточки — удобно для визуальной группировки (например, по
          проекту или клиенту).
        </p>
      </Section>

      <Section id="dates" icon={CalendarClock} title="Сроки и напоминания">
        <p>
          У задачи может быть <B>начало</B> и <B>срок</B>. Просроченные задачи
          подсвечиваются красным и помечаются <B>«Просрочено»</B> — но только пока
          они не в статусе «Готово».
        </p>
        <p>
          Система сама шлёт <B>напоминания</B>: исполнители и постановщик получают
          уведомление <B>«Дедлайн сегодня»</B>, <B>«завтра»</B> или{" "}
          <B>«Просрочено!»</B>. Каждое — не чаще раза в день на задачу.
        </p>
        <Tip>
          Задача, попавшая в «Завершённые», больше не считается просроченной и не
          напоминает о себе.
        </Tip>
      </Section>

      <Section id="recurrence" icon={Repeat} title="Повторение" color="text-violet-400">
        <p>
          В секции <B>«Повторение»</B> задайте ритм: каждый день / каждые N дней,
          по дням недели, по числам месяца. На карточке появится фиолетовый чип с
          описанием (например, «еженедельно: Пн, Ср»).
        </p>
        <p>
          Когда повторяющуюся задачу <B>завершают</B> (переносят в «Завершённые»
          или жмут <B>«Выполнить — перенести на следующую дату»</B>), она{" "}
          <B>не архивируется</B>: срок автоматически перескакивает на следующую
          дату, подтверждения исполнителей сбрасываются, и задача остаётся в
          работе. Так регулярные дела не теряются.
        </p>
      </Section>

      <Section id="assignees" icon={Users} title="Исполнители и подтверждение">
        <p>
          Назначайте одного или нескольких <B>исполнителей</B> — их аватары видны
          на карточке. Каждый исполнитель <B>подтверждает</B> выполнение своей
          части. Пока не подтвердили все, задачу нельзя перенести в «Завершённые».
        </p>
        <p>
          При назначении исполнитель получает уведомление. Упоминания и назначения
          приходят только тем, у кого есть доступ к этой задаче.
        </p>
      </Section>

      <Section id="subtasks" icon={CheckCheck} title="Подзадачи" color="text-emerald-400">
        <p>
          Разбейте задачу на шаги в секции <B>«Подзадачи»</B>. Прогресс (например,
          2/5) виден прямо на карточке и зеленеет, когда выполнены все.
        </p>
      </Section>

      <Section id="labels" icon={Tag} title="Метки">
        <p>
          <B>Метки</B> — цветные ярлыки для категоризации (тип работы, модуль,
          клиент). Создаются на уровне доски, назначаются задаче в один клик и
          участвуют в фильтрах.
        </p>
      </Section>

      <Section id="links" icon={Share2} title="Связи задач">
        <p>
          Связывайте задачи между собой (зависимости, «блокирует / связана»).
          Кнопка <B>«Связи»</B> в шапке доски показывает граф связей, а на
          карточке видно входящие и исходящие стрелки.
        </p>
      </Section>

      <Section id="comments" icon={MessageSquare} title="Комментарии и упоминания">
        <p>
          Обсуждайте задачу в комментариях: <B>@упоминание</B> отправит человеку
          уведомление (если у него есть доступ), можно ставить <B>реакции</B>{" "}
          эмодзи и прикреплять файлы. Свои комментарии можно править и удалять.
        </p>
      </Section>

      <Section id="files" icon={Paperclip} title="Файлы">
        <p>
          Прикрепляйте вложения к задаче и к комментариям. Изображения и видео
          открываются во встроенном лайтбоксе, остальные файлы — скачиваются.
        </p>
      </Section>

      <Section id="time" icon={Clock} title="Учёт времени">
        <p>
          В секции <B>«Учёт времени»</B> логируйте потраченные минуты с заметкой.
          Свои записи можно редактировать и удалять. Сумма видна в задаче.
        </p>
      </Section>

      <Section id="views" icon={Filter} title="Виды и фильтры">
        <p>
          Доску можно смотреть как <B>Доску</B>, <B>Список</B> или <B>Таблицу</B> —
          переключатель в шапке. Рядом — фильтры:
        </p>
        <Bullets>
          <Li><B>Мои</B> — только задачи, где вы исполнитель.</Li>
          <Li><B>Исполнитель</B>, <B>Приоритет</B>, <B>Срок</B>, <B>Поиск по доске</B>.</Li>
          <Li><B>Виды</B> — сохраняйте набор фильтров как именованный вид и переключайтесь между ними.</Li>
        </Bullets>
      </Section>

      <Section id="dashboard" icon={LayoutDashboard} title="Дашборд">
        <p>
          Стартовая страница: счётчики <B>активных / просроченных / на сегодня / на
          неделе</B>, список <B>ваших задач</B> и ваши <B>доски</B>. Быстрый
          ответ на вопрос «что мне делать сейчас».
        </p>
      </Section>

      <Section id="calendar" icon={CalendarDays} title="Календарь">
        <p>
          Все задачи со сроками на одной сетке. Переключайте <B>Месяц / Неделя /
          День</B>. Задачу можно <B>перетащить на другую дату</B> прямо в
          календаре — срок обновится.
        </p>
      </Section>

      <Section id="workload" icon={BarChart2} title="Нагрузка">
        <p>
          Сколько задач на каждом человеке и сколько из них просрочено. Помогает
          ровно распределять работу и замечать перегруз.
        </p>
      </Section>

      <Section id="inbox" icon={Bell} title="Входящие">
        <p>
          Центр уведомлений: упоминания, назначения, дедлайны, завершения.
          Фильтр <B>«Непрочитанные»</B>, кнопки <B>«Прочитать всё»</B> и{" "}
          <B>«Очистить»</B>. Клик по уведомлению ведёт прямо к задаче или чату.
          Колокольчик показывает количество непрочитанных в реальном времени.
        </p>
      </Section>

      <Section id="messages" icon={MessageCircle} title="Сообщения" color="text-indigo-400">
        <p>
          Встроенный мессенджер: <B>личные чаты</B> и <B>чаты досок</B>. Вложения
          (фото / видео / файлы), редактирование и удаление сообщений, эмодзи,
          лайтбокс для медиа. Онлайн-статус собеседников — в реальном времени.
        </p>
      </Section>

      <Section id="search" icon={Command} title="Поиск и командная палитра">
        <p>
          Страница <B>Поиск</B> ищет по задачам, доскам и людям. А ещё везде
          работает <B>командная палитра</B>: нажмите <Kbd>⌘</Kbd>+<Kbd>K</Kbd>{" "}
          (или <Kbd>Ctrl</Kbd>+<Kbd>K</Kbd>) — мгновенный поиск, переход по
          разделам и <B>быстрое создание задачи</B>.
        </p>
      </Section>

      <Section id="permissions" icon={Shield} title="Права доступа">
        <p>
          Доступ настраивается гибко — по ролям и по конкретным пользователям. Есть{" "}
          <B>гранулярные права</B> (просмотр/создание/редактирование/удаление для
          досок, задач, колонок, комментариев, файлов, времени, меток, экспорта).
        </p>
        <Bullets>
          <Li>Готовые <B>шаблоны прав</B>, включая «Стандарт», — в обеих вкладках («По ролям» и «По пользователям»).</Li>
          <Li>На уровне доски действуют роли <B>Владелец / Редактор / Комментатор / Наблюдатель</B>.</Li>
          <Li><Eye className="inline h-3.5 w-3.5 -translate-y-0.5" /> Наблюдатель видит доску, но не может ничего менять.</Li>
        </Bullets>
      </Section>

      <Section id="templates" icon={LayoutTemplate} title="Шаблоны">
        <p>
          При создании доски можно взять готовую структуру колонок: <B>Стандарт</B>{" "}
          (канбан), <B>Баг-трекер</B>, <B>Найм</B>, <B>Личные задачи</B>.
          Администраторы управляют шаблонами в админке.
        </p>
      </Section>

      <Section id="mobile" icon={Smartphone} title="Мобильное и PWA" color="text-emerald-400">
        <p>
          Интерфейс адаптирован под телефон: внизу — <B>нижняя навигация</B>{" "}
          (Дашборд, Доски, Сообщения, Входящие, Ещё), колонки доски листаются{" "}
          <B>свайпом</B>, окно задачи открывается как <B>шторка снизу</B>.
        </p>
        <p>
          Приложение можно <B>установить как PWA</B>: в браузере выберите
          «Установить приложение» / «На экран Домой» — Projectra появится иконкой и
          будет открываться в отдельном окне.
        </p>
      </Section>

      <Section id="hotkeys" icon={Keyboard} title="Горячие клавиши">
        <Bullets>
          <Li><Kbd>⌘</Kbd>/<Kbd>Ctrl</Kbd>+<Kbd>K</Kbd> — командная палитра (поиск, переходы, создать задачу).</Li>
          <Li><Kbd>↑</Kbd> <Kbd>↓</Kbd> — выбор в палитре, <Kbd>Enter</Kbd> — открыть, <Kbd>Esc</Kbd> — закрыть.</Li>
          <Li><Kbd>Enter</Kbd> — подтвердить добавление задачи или колонки в поле ввода.</Li>
          <Li><Kbd>Esc</Kbd> — закрыть окно задачи / отменить добавление.</Li>
        </Bullets>
        <Tip>
          Нужна помощь по конкретному действию? Почти у каждой кнопки есть
          подсказка при наведении — задержите курсор на иконке.
        </Tip>
      </Section>
    </>
  );
}
