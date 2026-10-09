import { lazy, Suspense } from "react";
import type { AuthUser } from "../auth";
import type { Book } from "../pages/SiddurPage";
import type { AppModal } from "../lib/appInteractions";
import type { Location } from "../lib/locations";
import type { PublicProfile } from "../lib/userApi";
import type { Announcement } from "../hooks/useAnnouncements";

const MoreToolsModal = lazy(() => import("../pages/MoreToolsModal"));
const AdminModal = lazy(() => import("../modals/AdminModal"));
const AnnouncementsModal = lazy(() => import("../modals/AnnouncementsModal"));
const BirthdayModal = lazy(() => import("../modals/BirthdayModal"));
const BookReaderModal = lazy(() => import("../modals/BookReaderModal"));
const CensusModal = lazy(() => import("../modals/CensusModal"));
const CommunityModal = lazy(() => import("../modals/CommunityModal"));
const CommunityYahrzeitModal = lazy(() => import("../modals/CommunityYahrzeitModal"));
const DafYomiModal = lazy(() => import("../modals/DafYomiModal"));
const DayModal = lazy(() => import("../modals/DayModal"));
const EventsModal = lazy(() => import("../modals/EventsModal"));
const FeedbackCenterModal = lazy(() => import("../modals/FeedbackCenterModal"));
const HebrewDateModal = lazy(() => import("../modals/HebrewDateModal"));
const HolidaysModal = lazy(() => import("../modals/HolidaysModal"));
const LocationMapModal = lazy(() => import("../modals/LocationMapModal"));
const LuachModal = lazy(() => import("../modals/LuachModal"));
const MemberDirectoryModal = lazy(() => import("../modals/MemberDirectoryModal"));
const MikvehCalendarModal = lazy(() => import("../modals/MikvehCalendarModal"));
const MussarModal = lazy(() => import("../modals/MussarModal"));
const OmerModal = lazy(() => import("../modals/OmerModal"));
const ParashahModal = lazy(() => import("../modals/ParashahModal"));
const PrayerBoardModal = lazy(() => import("../modals/PrayerBoardModal"));
const PrayerTimesModal = lazy(() => import("../modals/PrayerTimesModal"));
const PremiumModal = lazy(() => import("../modals/PremiumModal"));
const ProfileModal = lazy(() => import("../modals/ProfileModal"));
const RemembranceCenterModal = lazy(() => import("../modals/RemembranceCenterModal"));
const SefariaSearchModal = lazy(() => import("../modals/SefariaSearchModal"));
const TaharaModal = lazy(() => import("../modals/TaharaModal"));
const TorahTrackerModal = lazy(() => import("../modals/TorahTrackerModal"));
const WhatsNewModal = lazy(() => import("../modals/WhatsNewModal"));
const YartzeitModal = lazy(() => import("../modals/YartzeitModal"));
const ZmanimInfoModal = lazy(() => import("../modals/ZmanimInfoModal"));

export interface SelectedDay {
  day: number;
  month: number;
  year: number;
}

interface AppModalHostProps {
  modal: AppModal | null;
  onClose: () => void;
  onOpenModal: (modal: AppModal) => void;
  onNavigate: (page: string) => void;
  location: Location;
  user: AuthUser | null;
  isAdmin: boolean;
  isPremium: boolean;
  candleEnabled: boolean;
  onToggleCandle: () => void;
  announcements: Announcement[];
  onAddAnnouncement: (data: Omit<Announcement, "id" | "sentAt">) => Announcement;
  onUpdateAnnouncement: (id: string, patch: Partial<Announcement>) => void;
  onDeleteAnnouncement: (id: string) => void;
  onSendAnnouncement: (announcement: Announcement) => void;
  book: Book | null;
  day: SelectedDay | null;
  onRefreshBooks: () => void;
  onProfileSaved: (profile: PublicProfile) => void;
  onPremiumActivated: () => void;
}

export default function AppModalHost({
  modal,
  onClose,
  onOpenModal,
  onNavigate,
  location,
  user,
  isAdmin,
  isPremium,
  candleEnabled,
  onToggleCandle,
  announcements,
  onAddAnnouncement,
  onUpdateAnnouncement,
  onDeleteAnnouncement,
  onSendAnnouncement,
  book,
  day,
  onRefreshBooks,
  onProfileSaved,
  onPremiumActivated,
}: AppModalHostProps) {
  const open = (name: AppModal) => () => onOpenModal(name);

  return (
    <Suspense fallback={null}>
      {modal === "moreTools" && (
        <MoreToolsModal
          onClose={onClose}
          onTahara={open("tahara")}
          onYartzeit={open("yartzeit")}
          onCommunity={open("community")}
          onCensus={open("census")}
          onSettings={() => onNavigate("settings")}
          onDafYomi={open("dafYomi")}
          onBirthday={open("birthday")}
          onOmer={open("omer")}
          onPrayers={open("prayerTimes")}
          onSefariaSearch={open("sefariaSearch")}
          onHebrewDate={open("hebrewDate")}
          onLuach={open("luach")}
          onMussar={open("mussar")}
          onAnnouncements={open("announcements")}
          onEvents={open("events")}
          onMembers={open("members")}
          onPrayerBoard={open("prayerBoard")}
          onTorahTracker={open("torahTracker")}
          isPremium={isPremium}
          candleEnabled={candleEnabled}
          onToggleCandle={onToggleCandle}
          onShowPremium={() => onNavigate("premium")}
        />
      )}
      {modal === "admin" && (
        <AdminModal onClose={onClose} onRefresh={onRefreshBooks} />
      )}
      {modal === "announcements" && (
        <AnnouncementsModal
          onClose={onClose}
          announcements={announcements}
          onAdd={onAddAnnouncement}
          onUpdate={onUpdateAnnouncement}
          onDelete={onDeleteAnnouncement}
          onSendNow={onSendAnnouncement}
          isAdmin={isAdmin}
        />
      )}
      {modal === "birthday" && <BirthdayModal onClose={onClose} />}
      {modal === "bookReader" && book && (
        <BookReaderModal book={book} onClose={onClose} />
      )}
      {modal === "census" && (
        <CensusModal onClose={onClose} isAdmin={isAdmin} />
      )}
      {modal === "community" && (
        <CommunityModal onClose={onClose} isAdmin={isAdmin} />
      )}
      {modal === "communityYahrzeit" && (
        <CommunityYahrzeitModal
          onClose={onClose}
          userName={user?.fullName ?? ""}
        />
      )}
      {modal === "dafYomi" && <DafYomiModal onClose={onClose} />}
      {modal === "day" && day && (
        <DayModal
          day={day.day}
          month={day.month}
          year={day.year}
          location={location}
          onClose={onClose}
        />
      )}
      {modal === "events" && (
        <EventsModal onClose={onClose} isAdmin={isAdmin} />
      )}
      {modal === "feedback" && (
        <FeedbackCenterModal onClose={onClose} isAdmin={isAdmin} />
      )}
      {modal === "hebrewDate" && <HebrewDateModal onClose={onClose} />}
      {modal === "holidays" && <HolidaysModal onClose={onClose} />}
      {modal === "locationMap" && (
        <LocationMapModal location={location} onClose={onClose} />
      )}
      {modal === "luach" && <LuachModal onClose={onClose} />}
      {modal === "members" && (
        <MemberDirectoryModal onClose={onClose} isAdmin={isAdmin} />
      )}
      {modal === "mikvehCalendar" && (
        <MikvehCalendarModal onClose={onClose} />
      )}
      {modal === "mussar" && <MussarModal onClose={onClose} />}
      {modal === "omer" && <OmerModal onClose={onClose} />}
      {modal === "parashah" && <ParashahModal onClose={onClose} />}
      {modal === "prayerBoard" && (
        <PrayerBoardModal
          onClose={onClose}
          userName={user?.fullName ?? ""}
          isAdmin={isAdmin}
        />
      )}
      {modal === "prayerTimes" && (
        <PrayerTimesModal
          onClose={onClose}
          location={location}
          onSettings={() => onNavigate("settings")}
        />
      )}
      {modal === "premium" && (
        <PremiumModal onClose={onClose} onActivated={onPremiumActivated} />
      )}
      {modal === "profile" && (
        <ProfileModal onClose={onClose} onSaved={onProfileSaved} />
      )}
      {modal === "memorialWall" && (
        <RemembranceCenterModal onClose={onClose} />
      )}
      {modal === "sefariaSearch" && (
        <SefariaSearchModal onClose={onClose} />
      )}
      {modal === "tahara" && (
        <TaharaModal
          onClose={onClose}
          onMikvehCalendar={open("mikvehCalendar")}
        />
      )}
      {modal === "torahTracker" && <TorahTrackerModal onClose={onClose} />}
      {modal === "whatsNew" && <WhatsNewModal onClose={onClose} />}
      {modal === "yartzeit" && (
        <YartzeitModal
          onClose={onClose}
          location={location}
          onCommunityBoard={open("communityYahrzeit")}
        />
      )}
      {modal === "zmanimInfo" && <ZmanimInfoModal onClose={onClose} />}
    </Suspense>
  );
}
