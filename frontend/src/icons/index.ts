/**
 * icons/index.ts
 *
 * Single source of truth for all icons in the project.
 * All icon imports across the codebase should come from here — never
 * directly from lucide-react or any other icon library — so that:
 *   1. Tree-shaking removes every unused icon in one pass.
 *   2. Swapping or aliasing icons only requires a change in this file.
 *   3. Bundle analysis tools surface icon usage accurately.
 *
 * Bundle-size note (Issue: Standardize on lucide-react)
 * -------------------------------------------------------
 * lucide-react ships individual ESM modules, so only the icons listed
 * here are included in the final bundle.  Do NOT do:
 *   import * as Icons from 'lucide-react'   ← pulls everything in
 * Always use named exports from this barrel file instead.
 */

// ── Navigation & UI chrome ──────────────────────────────────────────────────
export {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Menu,
  X,
  Search,
  Bell,
  Settings,
  MoreHorizontal,
  MoreVertical,
  ExternalLink,
  Copy,
  Check,
  Info,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";

// ── Auth & Security ─────────────────────────────────────────────────────────
export {
  Lock,
  Unlock,
  Key,
  ShieldCheck,
  ShieldAlert,
  Fingerprint,
  Eye,
  EyeOff,
  LogIn,
  LogOut,
  UserPlus,
  User,
  Users,
} from "lucide-react";

// ── Finance & Project ───────────────────────────────────────────────────────
export {
  Target,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart2,
  PieChart,
  Activity,
  Wallet,
  CreditCard,
  Landmark,
  Coins,
  ArrowUpDown,
  RefreshCw,
  Clock,
  Clock8,
  Calendar,
  CalendarCheck,
} from "lucide-react";

// ── Social & Community ──────────────────────────────────────────────────────
export {
  Heart,
  ThumbsUp,
  MessageSquare,
  Share2,
  Bookmark,
  Star,
  Award,
  Zap,
  Sparkles,
} from "lucide-react";

// ── Misc / Utility ──────────────────────────────────────────────────────────
export {
  Sun,
  Leaf,
  Globe,
  MapPin,
  Upload,
  Download,
  FileText,
  Image,
  Link,
  Mail,
  Phone,
  Loader2,
  Cpu,
  HardDrive,
  Wifi,
  WifiOff,
} from "lucide-react";
