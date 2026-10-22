import { useState, useEffect, useCallback, useRef } from "react";
import "./App.css";
import { supabase } from "./supabaseClient";
import { useToast } from "./hooks/useToast";

import ToastContainer from "./components/ToastContainer";
import LoadingScreen from "./components/LoadingScreen";
import Sidebar from "./components/Sidebar";

import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import RegisterPage from "./pages/RegisterPage";
import CompleteGoogleProfile from "./pages/CompleteGoogleProfile";
import DoctorCaseList from "./pages/DoctorCaseList";
import AddNewCase from "./pages/AddNewCase";
import DoctorDashboard from "./pages/DoctorDashboard";
import PatientDashboard from "./pages/PatientDashboard";

// Placeholder results shown in the dashboards until the real model is connected.
const doctorData = {
  tumorType: "Glioblastoma",
  probabilities: [
    { name: "Glioblastoma", value: 78 },
    { name: "Astrocytoma", value: 15 },
    { name: "Oligodendroglioma", value: 7 },
  ],
  grade: "High-grade (IV)",
  idh: "Wild-type",
  mgmt: "Unmethylated",
  survival: "Estimated: 10–16 months",
  xaiFeatures: [
    { name: "Tumor Volume", importance: 92 },
    { name: "Age", importance: 78 },
    { name: "ADC Entropy", importance: 65 },
    { name: "rCBV Mean", importance: 54 },
    { name: "FLAIR Ratio", importance: 41 },
  ],
};

const DEFAULT_VISIBILITY = {
  scan_findings: true,
  growth_pattern: true,
  treatment_considerations: true,
  surgical_assessment: false,
  next_steps: true,
  tumor_type: false,
  survival_estimate: false,
  clinical_markers: false,
  xai_explanation: false,
  doctor_note: "",
};

// Pages a user is on BEFORE they are inside the app. Only from these pages does a finished
// profile load send the user to a dashboard (it must not move someone who is already working).
const ENTRY_PAGES = ["login", "completeGoogleProfile", "resetPassword"];

const dashboardFor = (profile) =>
  profile.role === "doctor" ? "doctorSelect" : "patientDashboard";

function App() {
  const [page, setPage] = useState("login");
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [selectedCase, setSelectedCase] = useState(null);
  const [cases, setCases] = useState([]);
  const [patientVisibility, setPatientVisibility] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loginKey, setLoginKey] = useState(0); // bump to reset the login form after a failed sign-in

  const pageRef = useRef(page);
  const recoveryRef = useRef(false);            // true while the user is resetting a forgotten password
  const profileLoadsRef = useRef(new Set());    // user ids whose profile is being loaded right now

  const { toasts, toast, removeToast } = useToast();
  const userId = session?.user?.id;

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  const handleLoginSuccess = useCallback(
    (profile) => {
      toast.success(
        `Welcome back, ${profile.full_name.split(" ")[0]}!`,
        profile.role === "doctor"
          ? "You are logged in as a Doctor."
          : "You are logged in. Your results are ready to view."
      );
    },
    [toast]
  );

  const loadProfile = useCallback(
    async (id, authUser) => {
      if (recoveryRef.current) {
        setLoadingAuth(false);
        return;
      }

      // The register form creates the profile itself; ignore the temporary session it opens.
      if (pageRef.current === "register") {
        setLoadingAuth(false);
        return;
      }

      // Avoid duplicate profile requests for the same user.
      if (profileLoadsRef.current.has(id)) return;
      profileLoadsRef.current.add(id);

      try {
        let data = null;
        let error = null;

        // Email sign-ups: retry briefly, the profile insert may still be completing.
        // Google users have no profile row on their first login, so there is nothing to wait for.
        const provider = authUser?.app_metadata?.provider;
        const attempts = provider && provider !== "email" ? 1 : 3;

        for (let i = 0; i < attempts; i++) {
          const result = await supabase
            .from("users")
            .select("*")
            .eq("id", id)
            .maybeSingle();

          data = result.data;
          error = result.error;

          if (data || error) break;

          if (i < attempts - 1) {
            await new Promise((resolve) => setTimeout(resolve, 800));
          }
        }

        if (recoveryRef.current) return;

        const atEntryPage = ENTRY_PAGES.includes(pageRef.current);

        if (error) {
          console.error("Profile lookup failed:", error.message);

          // While signing in, a failed lookup must not leave the user stuck on "Signing you in…".
          if (atEntryPage) {
            toast.error("Unable to load profile", "Please sign in again.");
            await supabase.auth.signOut();
          }
          return;
        }

        if (!data) {
          const user = authUser ?? (await supabase.auth.getUser()).data.user;

          const isGoogleUser =
            user?.app_metadata?.provider === "google" ||
            user?.identities?.some((identity) => identity.provider === "google");

          if (isGoogleUser) {
            // First Google sign-in: ask for role / hospital before opening the app.
            setUserProfile(null);
            setPage("completeGoogleProfile");
          } else {
            console.error("No user profile found.");
            toast.error(
              "Profile not found",
              "Please register again or contact support."
            );
            await supabase.auth.signOut();
          }
          return;
        }

        setUserProfile(data);

        if (atEntryPage) {
          setPage(dashboardFor(data));
          handleLoginSuccess(data);
        }
      } catch (err) {
        console.error("Profile loading error:", err);
        toast.error("Unable to load profile", "Check your connection and try again.");
      } finally {
        profileLoadsRef.current.delete(id);
        setLoadingAuth(false);
      }
    },
    [handleLoginSuccess, toast]
  );

  // ── Authentication state ────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;

    const handleAuthState = (event, currentSession) => {
      if (!active) return;

      if (event === "PASSWORD_RECOVERY") {
        // The user opened the link from the reset-password email.
        recoveryRef.current = true;
        setSession(currentSession);
        setPage("resetPassword");
        setLoadingAuth(false);
        return;
      }

      setSession(currentSession);

      if (!currentSession) {
        recoveryRef.current = false;
        setUserProfile(null);
        setLoginKey((key) => key + 1);
        // Keep the pages that are meant to be used while logged out (e.g. the "link expired" message).
        setPage((current) =>
          current === "register" || current === "forgotPassword" ? current : "login"
        );
        setLoadingAuth(false);
        return;
      }

      if (recoveryRef.current) {
        setLoadingAuth(false);
        return;
      }

      // Defer the profile request until after the auth callback returns.
      setTimeout(() => {
        if (active) loadProfile(currentSession.user.id, currentSession.user);
      }, 0);
    };

    // Opened from a reset-password email? (the link carries #type=recovery, or an error if it expired)
    const hash = window.location.hash;

    if (hash.includes("type=recovery")) {
      recoveryRef.current = true;
      setPage("resetPassword");
    }

    if (hash.includes("error_code=otp_expired")) {
      setPage("forgotPassword");
      toast.error("Link expired", "That reset link is no longer valid. Request a new one.");
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(handleAuthState);

    // Check the current session as well as future auth events.
    supabase.auth.getSession().then(({ data: { session: current } }) => {
      if (!active) return;

      setSession(current);

      if (current && !recoveryRef.current) {
        loadProfile(current.user.id, current.user);
      } else if (!current) {
        setLoadingAuth(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadProfile, toast]);

  // ── Doctor's cases ──────────────────────────────────────────────────────────
  const fetchCases = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from("cases")
      .select("*, visits(count)")
      .eq("doctor_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load cases:", error.message);
      return;
    }

    setCases(data ?? []);
  }, [userId]);

  useEffect(() => {
    if (userProfile?.role === "doctor" && userId) fetchCases();
  }, [userProfile?.role, userId, fetchCases]);

  // ── Patient-visibility settings of the selected case ───────────────────────
  useEffect(() => {
    if (!selectedCase) return;

    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from("patient_visibility")
        .select("*")
        .eq("case_id", selectedCase.id)
        .maybeSingle();

      if (!cancelled) setPatientVisibility(data ?? DEFAULT_VISIBILITY);
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedCase]);

  const nav = (nextPage) => setPage(nextPage);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error("Logout failed:", error.message);
        toast.error("Logout failed", "Please try again.");
        return;
      }

      // Reset local application state.
      setSession(null);
      setUserProfile(null);
      setCases([]);
      setSelectedCase(null);
      setPatientVisibility(null);

      profileLoadsRef.current.clear();
      recoveryRef.current = false;

      setPage("login");

      toast.success("Logged out", "You have been logged out successfully.");
    } catch (err) {
      console.error("Logout error:", err);
      toast.error("Logout failed", "Please try again.");
    }
  };

  // Called after a new Google user has filled in the profile form.
  const handleGoogleProfileComplete = (profile) => {
    setUserProfile(profile);
    setPage(dashboardFor(profile));   // doctors go to their case list, patients to their results

    toast.success(
      `Welcome, ${profile.full_name.split(" ")[0]}!`,
      "Your profile has been created successfully."
    );
  };

  if (loadingAuth) return <LoadingScreen />;

  return (
    <div className="shell">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <Sidebar
        page={page}
        userProfile={userProfile}
        nav={nav}
        onLogout={handleLogout}
        toast={toast}
      />

      <main className="main-content">
        {page === "login" && <LoginPage key={loginKey} nav={nav} />}

        {page === "register" && <RegisterPage nav={nav} toast={toast} />}

        {page === "completeGoogleProfile" && session && (
          <CompleteGoogleProfile
            session={session}
            nav={nav}
            onComplete={handleGoogleProfileComplete}
          />
        )}

        {page === "forgotPassword" && <ForgotPasswordPage nav={nav} />}

        {page === "resetPassword" && session && (
          <ResetPasswordPage
            toast={toast}
            onCancel={handleLogout}
            onDone={async () => {
              recoveryRef.current = false;

              // remove the recovery token from the address bar
              window.history.replaceState(null, "", window.location.pathname);

              profileLoadsRef.current.delete(session.user.id);
              await loadProfile(session.user.id, session.user);
            }}
          />
        )}

        {page === "doctorSelect" && (
          <DoctorCaseList
            cases={cases}
            setSelectedCase={setSelectedCase}
            nav={nav}
            onRefresh={fetchCases}
            toast={toast}
          />
        )}

        {page === "addCase" && (
          <AddNewCase
            nav={nav}
            session={session}
            onCaseAdded={fetchCases}
            toast={toast}
          />
        )}

        {page === "addVisit" && selectedCase && (
          <AddNewCase
            nav={nav}
            session={session}
            onCaseAdded={fetchCases}
            toast={toast}
            followUpCase={selectedCase}
          />
        )}

        {page === "doctorDashboard" && selectedCase && (
          <DoctorDashboard
            patient={selectedCase}
            data={doctorData}
            nav={nav}
            session={session}
            patientVisibility={patientVisibility}
            setPatientVisibility={setPatientVisibility}
            toast={toast}
            setSelectedCase={setSelectedCase}
            onAddVisit={() => nav("addVisit")}
          />
        )}

        {page === "patientDashboard" && (
          <PatientDashboard
            session={session}
            data={doctorData}
            toast={toast}
          />
        )}
      </main>
    </div>
  );
}

export default App;
