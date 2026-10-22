// import { useState, useEffect, useCallback, useRef } from "react";
// import "./App.css";
// import { supabase } from "./supabaseClient";
// import { useToast } from "./hooks/useToast";

// import ToastContainer from "./components/ToastContainer";
// import LoadingScreen from "./components/LoadingScreen";
// import Sidebar from "./components/Sidebar";

// import LoginPage from "./pages/LoginPage";
// import ForgotPasswordPage from "./pages/ForgotPasswordPage";
// import ResetPasswordPage from "./pages/ResetPasswordPage";
// import RegisterPage from "./pages/RegisterPage";
// import DoctorCaseList from "./pages/DoctorCaseList";
// import AddNewCase from "./pages/AddNewCase";
// import DoctorDashboard from "./pages/DoctorDashboard";
// import PatientDashboard from "./pages/PatientDashboard";

// function App() {
//   const [page, setPage]                   = useState("login");
//   const recoveryRef                       = useRef(false);   // true while the user is resetting a forgotten password
//   const [session, setSession]             = useState(null);
//   const [userProfile, setUserProfile]     = useState(null);
//   const [selectedCase, setSelectedCase]   = useState(null);
//   const [cases, setCases]                 = useState([]);
//   const [patientVisibility, setPatientVisibility] = useState(null);
//   const [loadingAuth, setLoadingAuth]     = useState(true);
//   const { toasts, toast, removeToast }    = useToast();

//   const doctorData = {
//     tumorType: "Glioblastoma",
//     probabilities: [
//       { name: "Glioblastoma",      value: 78 },
//       { name: "Astrocytoma",       value: 15 },
//       { name: "Oligodendroglioma", value: 7  },
//     ],
//     grade: "High-grade (IV)",
//     idh: "Wild-type",
//     mgmt: "Unmethylated",
//     survival: "Estimated: 10–16 months",
//     xaiFeatures: [
//       { name: "Tumor Volume", importance: 92 },
//       { name: "Age",          importance: 78 },
//       { name: "ADC Entropy",  importance: 65 },
//       { name: "rCBV Mean",    importance: 54 },
//       { name: "FLAIR Ratio",  importance: 41 },
//     ],
//   };

//   // ── Auth state listener ────────────────────────────────────────────────────
//   useEffect(() => {
//     // Opened from the "reset password" email?  (the link carries #type=recovery, or an error if it expired)
//     const hash = window.location.hash;
//     if (hash.includes("type=recovery")) { recoveryRef.current = true; setPage("resetPassword"); }
//     if (hash.includes("error_code=otp_expired")) {
//       setPage("forgotPassword");
//       toast.error("Link expired", "That reset link is no longer valid. Request a new one.");
//     }

//     supabase.auth.getSession().then(({ data: { session } }) => {
//       setSession(session);
//       if (session) loadProfile(session.user.id);
//       else setLoadingAuth(false);
//     });

//     const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
//       if (event === "PASSWORD_RECOVERY") {            // user landed from the reset email -> show "new password" form
//         recoveryRef.current = true;
//         setSession(session); setPage("resetPassword"); setLoadingAuth(false);
//         return;
//       }
//       setSession(session);
//       if (session) loadProfile(session.user.id);
//       else { setUserProfile(null); setPage("login"); setLoadingAuth(false); }
//     });

//     return () => subscription.unsubscribe();
//   }, []);

//   const loadProfile = async (userId) => {
//     if (recoveryRef.current) { setLoadingAuth(false); return; }    // password-reset flow: do not open the dashboard
//     // Retry up to 3 times — insert can be slightly delayed after signup
//     let data = null;
//     let error = null;
//     for (let i = 0; i < 3; i++) {
//       const res = await supabase
//         .from("users")
//         .select("*")
//         .eq("id", userId)
//         .single();
//       data = res.data;
//       error = res.error;
//       if (data) break;
//       await new Promise(r => setTimeout(r, 800));
//     }

//     if (recoveryRef.current) { setLoadingAuth(false); return; }
//     if (data) {
//       setUserProfile(data);
//       setPage(data.role === "doctor" ? "doctorSelect" : "patientDashboard");
//       handleLoginSuccess(data);
//     } else {
//       console.error("No user profile found:", error?.message);
//       await supabase.auth.signOut();
//       setPage("login");
//     }
//     setLoadingAuth(false);
//   };

//   // ── Load cases when doctor profile loads ──────────────────────────────────
//   useEffect(() => {
//     if (userProfile?.role === "doctor" && session) fetchCases();
//   }, [userProfile]);

//   const fetchCases = async () => {
//     const { data, error } = await supabase
//       .from("cases")
//       .select("*, visits(count)")
//       .eq("doctor_id", session.user.id)
//       .order("created_at", { ascending: false });
//     if (!error && data) setCases(data);
//   };

//   // ── Load visibility when a case is selected ────────────────────────────────
//   useEffect(() => {
//     if (selectedCase) fetchVisibility(selectedCase.id);
//   }, [selectedCase]);

//   const fetchVisibility = async (caseId) => {
//     const { data } = await supabase
//       .from("patient_visibility")
//       .select("*")
//       .eq("case_id", caseId)
//       .single();

//     setPatientVisibility(data ?? {
//       scan_findings: true, growth_pattern: true,
//       treatment_considerations: true, surgical_assessment: false,
//       next_steps: true, tumor_type: false,
//       survival_estimate: false, clinical_markers: false,
//       xai_explanation: false, doctor_note: "",
//     });
//   };

//   const nav = (p) => setPage(p);

//   const handleLogout = async () => {
//     await supabase.auth.signOut();
//     setCases([]); setSelectedCase(null);
//     setUserProfile(null); setPatientVisibility(null);
//     setPage("login");
//   };

//   // Show toast on login
//   const handleLoginSuccess = (profile) => {
//     toast.success(
//       `Welcome back, ${profile.full_name.split(" ")[0]}!`,
//       profile.role === "doctor"
//         ? "You are logged in as a Doctor."
//         : "You are logged in. Your results are ready to view."
//     );
//   };

//   if (loadingAuth) return <LoadingScreen />;

//   return (
//     <div className="shell">
//       <ToastContainer toasts={toasts} removeToast={removeToast} />
//       <Sidebar page={page} userProfile={userProfile} nav={nav} onLogout={handleLogout} toast={toast} />
//       <main className="main-content">
//         {page === "login"    && <LoginPage nav={nav} toast={toast} />}
//         {page === "register" && <RegisterPage nav={nav} toast={toast} />}
//         {page === "forgotPassword" && <ForgotPasswordPage nav={nav} />}
//         {page === "resetPassword" && session && (
//           <ResetPasswordPage
//             toast={toast} onCancel={handleLogout}
//             onDone={async () => {
//               recoveryRef.current = false;
//               window.history.replaceState(null, "", window.location.pathname);   // remove the token from the address bar
//               await loadProfile(session.user.id);
//             }}
//           />
//         )}
//         {page === "doctorSelect" && (
//           <DoctorCaseList cases={cases} setSelectedCase={setSelectedCase} nav={nav} onRefresh={fetchCases} toast={toast} />
//         )}
//         {page === "addCase" && (
//           <AddNewCase nav={nav} session={session} onCaseAdded={fetchCases} toast={toast} />
//         )}
//         {page === "addVisit" && selectedCase && (
//           <AddNewCase
//             nav={nav} session={session} onCaseAdded={fetchCases} toast={toast}
//             followUpCase={selectedCase}
//           />
//         )}
//         {page === "doctorDashboard" && selectedCase && (
//           <DoctorDashboard
//             patient={selectedCase} data={doctorData} nav={nav} session={session}
//             patientVisibility={patientVisibility} setPatientVisibility={setPatientVisibility}
//             toast={toast} setSelectedCase={setSelectedCase}
//             onAddVisit={() => nav("addVisit")}
//           />
//         )}
//         {page === "patientDashboard" && (
//           <PatientDashboard nav={nav} session={session} data={doctorData} toast={toast} />
//         )}
//       </main>
//     </div>
//   );
// }


// export default App;


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
import ProfilePage from "./pages/ProfilePage";
import { REQUIRE_DOCTOR_APPROVAL } from "./utils/featureFlags";

function App() {
  const [page, setPage] = useState("login");
  const recoveryRef = useRef(false);
  const profileLoadsRef = useRef(new Set());

  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [selectedCase, setSelectedCase] = useState(null);
  const [cases, setCases] = useState([]);
  const [patientVisibility, setPatientVisibility] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const { toasts, toast, removeToast } = useToast();

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
    async (userId, authUser) => {
      if (recoveryRef.current) {
        setLoadingAuth(false);
        return;
      }

      // Avoid duplicate profile requests for the same user.
      if (profileLoadsRef.current.has(userId)) return;
      profileLoadsRef.current.add(userId);

      try {
        let data = null;
        let error = null;

        // Retry briefly in case a profile insert is still completing.
        for (let i = 0; i < 3; i++) {
          const result = await supabase
            .from("users")
            .select("*")
            .eq("id", userId)
            .maybeSingle();

          data = result.data;
          error = result.error;

          if (data || error) break;

          await new Promise((resolve) => setTimeout(resolve, 800));
        }

        if (recoveryRef.current) return;

        if (error) {
          console.error("Profile lookup failed:", error.message);
          toast.error(
            "Unable to load profile",
            "Please try again."
          );
          return;
        }

        if (!data) {
          const user = authUser ?? (
            await supabase.auth.getUser()
          ).data.user;

          const isGoogleUser =
            user?.app_metadata?.provider === "google" ||
            user?.identities?.some(
              (identity) => identity.provider === "google"
            );

          if (isGoogleUser) {
            setUserProfile(null);
            setPage("completeGoogleProfile");
          } else {
            console.error("No user profile found.");
            await supabase.auth.signOut();
            setPage("login");
            toast.error(
              "Profile not found",
              "Please register again or contact support."
            );
          }

          return;
        }

        // A doctor must be approved before accessing the doctor area.
        if (
          REQUIRE_DOCTOR_APPROVAL &&
          data.role === "doctor" &&
          data.doctor_verified !== true
        ) {
          await supabase.auth.signOut();
          setUserProfile(null);
          setPage("login");

          toast.error(
            "Doctor account pending",
            "Your account must be approved before you can access the doctor area."
          );

          return;
        }

        setUserProfile(data);
        setPage(
          data.role === "doctor"
            ? "doctorSelect"
            : "patientDashboard"
        );
        handleLoginSuccess(data);
      } catch (err) {
        console.error("Profile loading error:", err);
        toast.error(
          "Unable to load profile",
          "Check your connection and try again."
        );
      } finally {
        profileLoadsRef.current.delete(userId);
        setLoadingAuth(false);
      }
    },
    [handleLoginSuccess, toast]
  );

  // Authentication state listener
  useEffect(() => {
    let active = true;

    const handleAuthState = (event, currentSession) => {
      if (!active) return;

      if (event === "PASSWORD_RECOVERY") {
        recoveryRef.current = true;
        setSession(currentSession);
        setPage("resetPassword");
        setLoadingAuth(false);
        return;
      }

      setSession(currentSession);

      if (!currentSession) {
        setUserProfile(null);
        setPage("login");
        setLoadingAuth(false);
        return;
      }

      if (recoveryRef.current) {
        setLoadingAuth(false);
        return;
      }

      // Defer the profile request until after the auth callback returns.
      setTimeout(() => {
        if (active) {
          loadProfile(
            currentSession.user.id,
            currentSession.user
          );
        }
      }, 0);
    };

    const hash = window.location.hash;

    if (hash.includes("type=recovery")) {
      recoveryRef.current = true;
      setPage("resetPassword");
    }

    if (hash.includes("error_code=otp_expired")) {
      setPage("forgotPassword");
      toast.error(
        "Link expired",
        "That reset link is no longer valid. Request a new one."
      );
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

  // Load cases when a doctor profile loads.
  useEffect(() => {
    if (userProfile?.role === "doctor" && session) {
      fetchCases();
    }
  }, [userProfile, session]);

  const fetchCases = async () => {
    if (!session?.user?.id) return;

    const { data, error } = await supabase
      .from("cases")
      .select("*, visits(count)")
      .eq("doctor_id", session.user.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setCases(data);
    } else if (error) {
      console.error("Failed to load cases:", error.message);
    }
  };

  // Load visibility when a case is selected.
  useEffect(() => {
    if (selectedCase) {
      fetchVisibility(selectedCase.id);
    }
  }, [selectedCase]);

  const fetchVisibility = async (caseId) => {
    const { data } = await supabase
      .from("patient_visibility")
      .select("*")
      .eq("case_id", caseId)
      .maybeSingle();

    setPatientVisibility(
      data ?? {
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
      }
    );
  };

  const nav = (nextPage) => setPage(nextPage);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCases([]);
    setSelectedCase(null);
    setUserProfile(null);
    setPatientVisibility(null);
    setPage("login");
  };

  const handleGoogleProfileComplete = (profile) => {
    setUserProfile(profile);
    setPage(profile.role === "doctor" ? "doctorSelect" : "patientDashboard");

    toast.success(
      `Welcome, ${profile.full_name.split(" ")[0]}!`,
      "Your profile has been created successfully."
    );
  };

  if (loadingAuth) return <LoadingScreen />;

  return (
    <div className="shell">
      <ToastContainer
        toasts={toasts}
        removeToast={removeToast}
      />

      <Sidebar
        page={page}
        userProfile={userProfile}
        nav={nav}
        onLogout={handleLogout}
        toast={toast}
      />

      <main className="main-content">
        {page === "login" && (
          <LoginPage nav={nav} toast={toast} />
        )}

        {page === "register" && (
          <RegisterPage nav={nav} toast={toast} />
        )}

        {page === "completeGoogleProfile" && session && (
          <CompleteGoogleProfile
            session={session}
            nav={nav}
            toast={toast}
            onComplete={handleGoogleProfileComplete}
          />
        )}

        {page === "forgotPassword" && (
          <ForgotPasswordPage nav={nav} />
        )}

        {page === "resetPassword" && session && (
          <ResetPasswordPage
            toast={toast}
            onCancel={handleLogout}
            onDone={async () => {
              recoveryRef.current = false;

              window.history.replaceState(
                null,
                "",
                window.location.pathname
              );

              profileLoadsRef.current.delete(session.user.id);
              await loadProfile(session.user.id, session.user);
            }}
          />
        )}

        {page === "profile" && userProfile && (
          <ProfilePage userProfile={userProfile} onLogout={handleLogout} />
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
            nav={nav}
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

