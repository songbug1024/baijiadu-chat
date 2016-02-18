module.exports = function(ChatMember) {
  ChatMember.allStatus = {
    deleted: 0,
    online: 1,
    offline: 2,
    busy: 3,
    leave: 4,
    invisible: 5
  }
};
