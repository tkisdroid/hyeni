export function deriveParentCapabilities(familyInfo, authUser, selectedRole) {
  const userId = authUser?.id || "";
  const role = familyInfo?.myRole || selectedRole || null;
  const members = Array.isArray(familyInfo?.members) ? familyInfo.members : [];
  const explicitPrimaryParentId = familyInfo?.primaryParentId || familyInfo?.parentId || "";
  const parentMembers = members.filter((member) => member?.role === "parent" && member?.user_id);
  const inferredPrimaryParentId = explicitPrimaryParentId
    || (familyInfo?.isCoParent === true ? "" : (parentMembers.length === 1 ? parentMembers[0].user_id : ""));
  const primaryParentId = inferredPrimaryParentId || "";
  const parentMember = members.find((member) => (
    member?.role === "parent" && member?.user_id === userId
  ));

  const isParentRole = role === "parent" || !!parentMember;
  const isPrimaryParent = !!userId && isParentRole && primaryParentId === userId;
  const isCoParent = !!userId && isParentRole && !!parentMember && !isPrimaryParent;
  const isChild = role === "child";

  return {
    isParentRole,
    isPrimaryParent,
    isCoParent,
    isChild,
    canManageFamily: isPrimaryParent,
    canWriteSchedule: isPrimaryParent,
    canManagePlaces: isPrimaryParent,
    canManageSubscription: isPrimaryParent,
    canRequestChildLocation: isPrimaryParent,
    canUseRemoteListen: isPrimaryParent,
    canUseForceRing: isPrimaryParent,
    canEditParentPhones: isPrimaryParent,
    canSendMemo: isParentRole || isChild,
    canGivePraiseSticker: isPrimaryParent || isCoParent,
    canReceiveSos: isPrimaryParent || isCoParent,
    canReceiveKkuk: isPrimaryParent,
  };
}
