// import { useRouter } from 'next/router';
// // components/withOrgAuth.tsx
// import { useSession } from 'next-auth/react';

// export function withOrgAuth(
//   Component: React.ComponentType,
//   requiredRole?: 'admin' | 'manager' | 'receptionist'
// ) {
//   return function ProtectedComponent(props: any) {
//     const { data: session, status } = useSession();
//     const router = useRouter();
//     const { universityId, dormId } = router.query;

//     // Loading state
//     if (status === 'loading' || !router.isReady) {
//       return <LoadingSpinner />;
//     }

//     // Not authenticated
//     if (!session) {
//       router.push('/auth/signin');
//       return null;
//     }

//     // Check if user has access to this org path
//     const hasAccess = checkUserAccess(session.user, universityId, dormId, requiredRole);
//     if (!hasAccess) {
//       router.push('/unauthorized');
//       return null;
//     }

//     return (
//       <OrgLayout>
//         <Component {...props} />
//       </OrgLayout>
//     );
//   };
// }

// // Usage
// export default withOrgAuth(DormDashboard, 'manager');

export function withOrgAuth() {
  return <div></div>
}